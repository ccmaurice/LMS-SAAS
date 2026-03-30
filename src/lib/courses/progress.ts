import { prisma } from "@/lib/db";

export async function recomputeEnrollmentProgress(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { include: { lessons: { select: { id: true } } } } },
  });
  if (!course) return;

  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const pct =
    totalLessons === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            ((await prisma.lessonProgress.count({
              where: { userId, lesson: { module: { courseId } } },
            })) /
              totalLessons) *
              100,
          ),
        );

  await prisma.enrollment.updateMany({
    where: { userId, courseId },
    data: { progressPercent: pct },
  });
}
