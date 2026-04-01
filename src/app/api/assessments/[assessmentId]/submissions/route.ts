import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canStudentTakeAssessment, getAssessmentInOrg } from "@/lib/assessments/access";
import { resolveStudentStartAttempt } from "@/lib/assessments/retake";

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

  if (!(await canStudentTakeAssessment(user.id, assessment))) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
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

  return NextResponse.json({
    submission: result.submission,
    locked: false,
    maxAttemptsPerStudent: maxAttempts,
    retakeRequiresApproval,
  });
}
