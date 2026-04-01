import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canTeacherManageCourse } from "@/lib/courses/access";
import { recomputeSubmissionTotals } from "@/lib/assessments/score";
import { notifySubmissionGradedIfNew } from "@/lib/notifications/assessment-graded";

const patchSchema = z.object({
  manualScore: z.number().min(0).max(10_000),
  manualComment: z.string().max(20_000).optional().nullable(),
  rubricScores: z.unknown().optional().nullable(),
  annotations: z.unknown().optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ answerId: string }> }) {
  const { answerId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const answer = await prisma.answer.findFirst({
    where: {
      id: answerId,
      submission: { assessment: { course: { organizationId: user.organizationId } } },
    },
    include: {
      submission: {
        include: {
          assessment: { include: { course: { select: { organizationId: true, createdById: true } } } },
        },
      },
      question: true,
    },
  });

  if (!answer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canTeacherManageCourse(user, answer.submission.assessment.course.createdById)) {
    return NextResponse.json({ error: "Only the course author or an admin can grade this answer" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const max = answer.question.points;
  const manualScore = Math.min(max, Math.max(0, parsed.data.manualScore));
  const orgId = answer.submission.assessment.course.organizationId;
  const prevManual = answer.manualScore;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.scoreOverrideLog.create({
      data: {
        answerId,
        organizationId: orgId,
        editorId: user.id,
        previousManualScore: prevManual,
        newManualScore: manualScore,
      },
    });
    await tx.gradingAuditLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        entityType: "Answer",
        entityId: answerId,
        action: "MANUAL_SCORE",
        payload: { previousManualScore: prevManual, newManualScore: manualScore },
      },
    });
    return tx.answer.update({
      where: { id: answerId },
      data: {
        manualScore,
        manualComment: parsed.data.manualComment?.trim() || null,
        gradedById: user.id,
        manualEditedAt: new Date(),
        ...(parsed.data.rubricScores !== undefined && {
          rubricScores: parsed.data.rubricScores === null ? Prisma.JsonNull : parsed.data.rubricScores,
        }),
        ...(parsed.data.annotations !== undefined && {
          annotations: parsed.data.annotations === null ? Prisma.JsonNull : parsed.data.annotations,
        }),
      },
    });
  });

  const prior = await prisma.submission.findUnique({
    where: { id: answer.submissionId },
    select: { status: true },
  });

  await recomputeSubmissionTotals(answer.submissionId);

  const answers = await prisma.answer.findMany({
    where: { submissionId: answer.submissionId },
    include: { question: true },
  });
  const allGraded = answers.every((a) => a.autoGraded || a.manualScore != null);

  const submission = await prisma.submission.update({
    where: { id: answer.submissionId },
    data: { status: allGraded ? "GRADED" : "SUBMITTED" },
    select: { id: true, totalScore: true, maxScore: true, status: true },
  });

  await notifySubmissionGradedIfNew(submission.id, prior?.status === "GRADED");

  return NextResponse.json({ answer: updated, submission });
}
