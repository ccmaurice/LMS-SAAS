import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { getEnrollment, getLessonInOrganization } from "@/lib/courses/access";
import { recomputeEnrollmentProgress } from "@/lib/courses/progress";

export async function POST(_req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const lesson = await getLessonInOrganization(lessonId, user.organizationId);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const courseId = lesson.module.courseId;
  const enrollment = await getEnrollment(user.id, courseId);
  if (!enrollment) {
    return NextResponse.json({ error: "Enroll in the course first" }, { status: 403 });
  }

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId },
    update: {},
  });

  await recomputeEnrollmentProgress(user.id, courseId);

  return NextResponse.json({ ok: true });
}
