import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canStudentTakeAssessment, getAssessmentInOrg } from "@/lib/assessments/access";

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

  const existing = await prisma.submission.findFirst({
    where: { assessmentId, userId: user.id },
    orderBy: { startedAt: "desc" },
  });

  if (existing?.status === "SUBMITTED" || existing?.status === "GRADED") {
    return NextResponse.json({ submission: existing, locked: true });
  }

  if (existing?.status === "DRAFT") {
    return NextResponse.json({ submission: existing, locked: false });
  }

  const submission = await prisma.submission.create({
    data: { assessmentId, userId: user.id, status: "DRAFT" },
  });

  return NextResponse.json({ submission, locked: false });
}
