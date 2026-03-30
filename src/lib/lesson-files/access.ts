import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEnrollment, getLessonInOrganization, isStaffRole } from "@/lib/courses/access";

export async function canAccessLessonDownload(
  user: { id: string; role: Role; organizationId: string },
  lessonId: string,
  courseId: string,
): Promise<boolean> {
  const lesson = await getLessonInOrganization(lessonId, user.organizationId);
  if (!lesson || lesson.module.courseId !== courseId) return false;
  if (isStaffRole(user.role)) return true;
  const enrollment = await getEnrollment(user.id, courseId);
  return !!enrollment;
}

export async function getLessonFileInOrg(fileId: string, organizationId: string) {
  return prisma.lessonFile.findFirst({
    where: { id: fileId, lesson: { module: { course: { organizationId } } } },
    include: {
      lesson: { include: { module: { include: { course: { select: { id: true } } } } } },
    },
  });
}
