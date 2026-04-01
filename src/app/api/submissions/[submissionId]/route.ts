import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { submissionTimedOut } from "@/lib/assessments/time";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";

const patchBodySchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export async function GET(_req: Request, ctx: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, assessment: { course: { organizationId: user.organizationId } } },
    include: {
      assessment: {
        include: {
          course: { select: { id: true, title: true, createdById: true } },
          questions: { orderBy: { order: "asc" } },
        },
      },
      answers: { include: { question: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isSubmitter = submission.userId === user.id;
  const privilegedStaff =
    isStaffRole(user.role) && canTeacherManageCourse(user, submission.assessment.course.createdById);

  let authorized = isSubmitter || privilegedStaff;
  if (!authorized && user.role === "PARENT") {
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        parentUserId: user.id,
        studentUserId: submission.userId,
        organizationId: user.organizationId,
      },
      select: { id: true },
    });
    authorized = !!link;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  /** Guardians may view scores/comments but not MCQ keys, model answers, or marking schemes. */
  const revealSolutions = privilegedStaff || (isSubmitter && submission.status !== "DRAFT");
  const showMarksAndComments = privilegedStaff || isSubmitter || user.role === "PARENT";

  return NextResponse.json({
    submission: {
      id: submission.id,
      status: submission.status,
      moderationState: submission.moderationState,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      assessment: {
        id: submission.assessment.id,
        title: submission.assessment.title,
        kind: submission.assessment.kind,
        timeLimitMinutes: submission.assessment.timeLimitMinutes,
        course: submission.assessment.course,
      },
      user: privilegedStaff ? submission.user : { id: submission.user.id, name: submission.user.name },
    },
    answers: submission.answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      content: a.content,
      score: a.score,
      manualScore: showMarksAndComments ? a.manualScore : null,
      manualComment: showMarksAndComments ? a.manualComment : null,
      autoGraded: a.autoGraded,
      question: revealSolutions
        ? a.question
        : {
            id: a.question.id,
            type: a.question.type,
            prompt: a.question.prompt,
            points: a.question.points,
          },
    })),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, userId: user.id },
    include: { assessment: { include: { questions: true } } },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (submission.status !== "DRAFT") {
    return NextResponse.json({ error: "Submission is locked" }, { status: 400 });
  }

  if (submissionTimedOut(submission.startedAt, submission.assessment.timeLimitMinutes)) {
    return NextResponse.json({ error: "Time limit exceeded" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const validIds = new Set(submission.assessment.questions.map((q) => q.id));

  for (const [questionId, content] of Object.entries(parsed.data.answers)) {
    if (!validIds.has(questionId)) continue;
    await prisma.answer.upsert({
      where: {
        submissionId_questionId: { submissionId, questionId },
      },
      create: {
        submissionId,
        questionId,
        content,
      },
      update: { content },
    });
  }

  const answers = await prisma.answer.findMany({ where: { submissionId } });
  return NextResponse.json({ ok: true, answerCount: answers.length });
}
