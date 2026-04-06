import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";

/** Staff: remove an in-progress draft so the student can start fresh (if attempts allow). */
export async function POST(_req: Request, ctx: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const sub = await prisma.submission.findFirst({
    where: { id: submissionId },
    include: {
      assessment: { select: { id: true, courseId: true, course: { select: { organizationId: true } } } },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sub.assessment.course.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await canTeacherActOnAssessmentCourse(user, sub.assessment.courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (sub.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft attempts can be discarded" }, { status: 400 });
  }

  await prisma.submission.delete({ where: { id: submissionId } });

  return NextResponse.json({ ok: true });
}
