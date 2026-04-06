import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
const patchSchema = z.object({
  moderationState: z.enum([
    "NONE",
    "FIRST_REVIEW",
    "SECOND_REVIEW",
    "EXTERNAL_REVIEW",
    "APPROVED",
  ]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, assessment: { course: { organizationId: user.organizationId } } },
    include: {
      assessment: { include: { course: { select: { organizationId: true, id: true } } } },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canTeacherActOnAssessmentCourse(user, submission.assessment.course.id))) {
    return NextResponse.json({ error: "You do not have permission to update moderation" }, { status: 403 });
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

  const orgId = submission.assessment.course.organizationId;

  const updated = await prisma.$transaction(async (tx) => {
    const sub = await tx.submission.update({
      where: { id: submissionId },
      data: { moderationState: parsed.data.moderationState },
      select: { id: true, moderationState: true },
    });
    await tx.gradingAuditLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        entityType: "Submission",
        entityId: submissionId,
        action: "MODERATION_STATE",
        payload: { moderationState: parsed.data.moderationState },
      },
    });
    return sub;
  });

  return NextResponse.json({ submission: updated });
}
