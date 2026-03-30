import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export function isStaffRole(role: Role): boolean {
  return role === "ADMIN" || role === "TEACHER";
}

export async function getCourseInOrganization(courseId: string, organizationId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, organizationId },
  });
}

export async function getModuleInOrganization(moduleId: string, organizationId: string) {
  return prisma.module.findFirst({
    where: { id: moduleId, course: { organizationId } },
    include: { course: true },
  });
}

export async function getLessonInOrganization(lessonId: string, organizationId: string) {
  return prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { organizationId } } },
    include: { module: { include: { course: true } } },
  });
}

export async function getEnrollment(userId: string, courseId: string) {
  return prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
}

export function canEditCourseAsStaff(role: Role): boolean {
  return isStaffRole(role);
}
