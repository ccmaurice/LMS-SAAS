import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";

export async function getAssessmentInOrg(assessmentId: string, organizationId: string) {
  return prisma.assessment.findFirst({
    where: { id: assessmentId, course: { organizationId } },
    include: { course: true },
  });
}

export async function assertCourseInOrg(courseId: string, organizationId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, organizationId },
  });
}

export function canManageAssessments(role: Role): boolean {
  return isStaffRole(role);
}

export async function canStudentViewAssessment(
  userId: string,
  role: Role,
  assessment: { published: boolean; courseId: string },
): Promise<boolean> {
  if (isStaffRole(role)) return true;
  if (role !== "STUDENT") return false;
  if (!assessment.published) return false;
  const en = await getEnrollment(userId, assessment.courseId);
  return !!en;
}

export async function canStudentTakeAssessment(
  userId: string,
  assessment: { published: boolean; courseId: string },
): Promise<boolean> {
  if (!assessment.published) return false;
  const en = await getEnrollment(userId, assessment.courseId);
  return !!en;
}
