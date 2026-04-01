import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  getEnrollment,
  getLessonInOrganization,
  getParentProgressUserIdForCourse,
} from "@/lib/courses/access";

export async function canAccessLessonDownload(
  user: { id: string; role: Role; organizationId: string },
  lessonId: string,
  courseId: string,
): Promise<boolean> {
  const lesson = await getLessonInOrganization(lessonId, user.organizationId);
  if (!lesson || lesson.module.courseId !== courseId) return false;
  const createdById = lesson.module.course.createdById;
  if (user.role === "ADMIN") return true;
  if (user.role === "TEACHER" && user.id === createdById) return true;
  const enrollment = await getEnrollment(user.id, courseId);
  if (enrollment) return true;
  if (user.role === "PARENT") {
    const childId = await getParentProgressUserIdForCourse(user.id, user.organizationId, courseId);
    return !!childId;
  }
  return false;
}

export async function getLessonFileInOrg(fileId: string, organizationId: string) {
  return prisma.lessonFile.findFirst({
    where: { id: fileId, lesson: { module: { course: { organizationId } } } },
    include: {
      lesson: { include: { module: { include: { course: { select: { id: true, createdById: true } } } } } },
    },
  });
}
