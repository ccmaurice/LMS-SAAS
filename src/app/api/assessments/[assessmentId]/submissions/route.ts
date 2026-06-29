import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/guard";
import { canStudentTakeAssessment, getAssessmentInOrg } from "@/lib/assessments/access";
import { findActiveDraft, resolveStudentStartAttempt } from "@/lib/assessments/retake";
import { isStaffRole } from "@/lib/courses/access";

function clampAttempts(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

export async function POST(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isStaff = isStaffRole(user.role);
  if (!isStaff && !(await canStudentTakeAssessment(user.id, assessment))) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  if (assessment.studentAttemptsLocked) {
    const draft = await findActiveDraft(assessmentId, user.id);
    if (!draft) {
      return NextResponse.json(
        {
          error: "This assessment is closed to new attempts right now.",
          code: "ATTEMPTS_LOCKED",
        },
        { status: 403 },
      );
    }
  }

  const maxAttempts = clampAttempts(assessment.maxAttemptsPerStudent);
  const retakeRequiresApproval = assessment.retakeRequiresApproval;

  const result = await resolveStudentStartAttempt(assessmentId, user.id, {
    maxAttemptsPerStudent: maxAttempts,
    retakeRequiresApproval,
  });

  if (result.kind === "locked") {
    return NextResponse.json({
      submission: result.submission,
      locked: true,
      needsRetakeApproval: result.needsRetakeApproval,
      completedAttempts: result.completedAttempts,
      maxAttemptsPerStudent: result.maxAttempts,
    });
  }

  if (result.kind !== "locked" && assessment.deliveryMode !== "FORMATIVE") {
    try {
      await prisma.proctoringEvent.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          assessmentId,
          submissionId: result.submission.id,
          eventType: "student_started_exam",
          payload: {
            description: `${user.name || user.email} started the proctored exam attempt.`,
            severity: "green",
          },
        },
      });
    } catch (e) {
      console.error("Failed to log student_started_exam event:", e);
    }
  }

  return NextResponse.json({
    submission: result.submission,
    locked: false,
    maxAttemptsPerStudent: maxAttempts,
    retakeRequiresApproval,
  });
}
