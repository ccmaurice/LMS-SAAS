import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getCourseInOrganization, getEnrollment, isStaffRole } from "@/lib/courses/access";

export async function getLearningResourceInOrg(resourceId: string, organizationId: string) {
  return prisma.learningResource.findFirst({
    where: { id: resourceId, organizationId },
  });
}

export async function canViewLearningResource(user: { id: string; organizationId: string; role: Role }, resourceId: string) {
  const row = await getLearningResourceInOrg(resourceId, user.organizationId);
  if (!row) return false;
  if (isStaffRole(user.role)) return true;
  return row.published;
}

export async function canAccessCourseChat(
  user: { id: string; organizationId: string; role: Role },
  courseId: string,
) {
  const course = await getCourseInOrganization(courseId, user.organizationId);
  if (!course) return false;
  if (isStaffRole(user.role)) return true;
  const en = await getEnrollment(user.id, courseId);
  return !!en;
}
