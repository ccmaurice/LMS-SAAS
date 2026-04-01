import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { canTeacherManageCourse, getCourseInOrganization, getEnrollment } from "@/lib/courses/access";

export async function getLearningResourceInOrg(resourceId: string, organizationId: string) {
  return prisma.learningResource.findFirst({
    where: { id: resourceId, organizationId },
  });
}

/** Admins manage any org resource; teachers only rows they created (legacy null = admin-only). */
export function canManageLearningResource(
  user: { id: string; role: Role },
  row: { createdById: string | null },
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TEACHER") return false;
  return row.createdById != null && row.createdById === user.id;
}

export async function canViewLearningResource(
  user: { id: string; organizationId: string; role: Role },
  resourceId: string,
) {
  const row = await getLearningResourceInOrg(resourceId, user.organizationId);
  if (!row) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "TEACHER") {
    if (row.published) return true;
    return row.createdById != null && row.createdById === user.id;
  }
  return row.published;
}

export async function canAccessCourseChat(
  user: { id: string; organizationId: string; role: Role },
  courseId: string,
) {
  const course = await getCourseInOrganization(courseId, user.organizationId);
  if (!course) return false;
  if (canTeacherManageCourse(user, course.createdById)) return true;
  const en = await getEnrollment(user.id, courseId);
  return !!en;
}
