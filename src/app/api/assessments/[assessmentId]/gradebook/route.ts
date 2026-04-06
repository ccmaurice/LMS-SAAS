import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canTeacherActOnAssessmentCourse(user, assessment.courseId))) {
    return NextResponse.json({ error: "You do not have permission to open this gradebook" }, { status: 403 });
  }

  const submissions = await prisma.submission.findMany({
    where: { assessmentId },
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      answers: { include: { question: true } },
    },
  });

  return NextResponse.json({ assessmentId, submissions });
}
