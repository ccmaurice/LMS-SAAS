import type { Enrollment } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/** Who may open course / lesson pages and whose lesson checkmarks to use. */
export type CourseLearnerGate = {
  canAccess: boolean;
  staff: boolean;
  enrollment: Enrollment | null;
  preview: boolean;
  /** Parent viewing because a linked student is enrolled in this course */
  parentViaChild: boolean;
  /** Lesson progress lookups (enrolled user or observed child) */
  progressUserId: string;
};

/** Admins may manage any course; teachers only courses they created. */
export function canTeacherManageCourse(
  user: { id: string; role: Role },
  courseCreatedById: string,
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "TEACHER") return user.id === courseCreatedById;
  return false;
}

export async function resolveCourseLearnerAccess(
  user: { id: string; role: Role; organizationId: string },
  courseId: string,
  coursePublished: boolean,
): Promise<CourseLearnerGate> {
  if (user.role === "ADMIN") {
    const enrollment = await getEnrollment(user.id, courseId);
    return {
      canAccess: true,
      staff: true,
      enrollment,
      preview: false,
      parentViaChild: false,
      progressUserId: user.id,
    };
  }

  if (user.role === "TEACHER") {
    const courseRow = await prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId },
      select: { createdById: true },
    });
    if (!courseRow) {
      return {
        canAccess: false,
        staff: false,
        enrollment: null,
        preview: false,
        parentViaChild: false,
        progressUserId: user.id,
      };
    }
    const enrollment = await getEnrollment(user.id, courseId);
    if (user.id === courseRow.createdById) {
      return {
        canAccess: true,
        staff: true,
        enrollment,
        preview: false,
        parentViaChild: false,
        progressUserId: user.id,
      };
    }
    if (enrollment) {
      return {
        canAccess: true,
        staff: false,
        enrollment,
        preview: false,
        parentViaChild: false,
        progressUserId: user.id,
      };
    }
    if (coursePublished) {
      return {
        canAccess: true,
        staff: false,
        enrollment: null,
        preview: true,
        parentViaChild: false,
        progressUserId: user.id,
      };
    }
    return {
      canAccess: false,
      staff: false,
      enrollment: null,
      preview: false,
      parentViaChild: false,
      progressUserId: user.id,
    };
  }

  const enrollment = await getEnrollment(user.id, courseId);
  if (enrollment) {
    return {
      canAccess: true,
      staff: false,
      enrollment,
      preview: false,
      parentViaChild: false,
      progressUserId: user.id,
    };
  }

  if (user.role === "STUDENT" && coursePublished) {
    return {
      canAccess: true,
      staff: false,
      enrollment: null,
      preview: true,
      parentViaChild: false,
      progressUserId: user.id,
    };
  }

  if (user.role === "PARENT") {
    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: user.id, organizationId: user.organizationId },
      select: { studentUserId: true },
    });
    const childIds = links.map((l) => l.studentUserId);
    if (childIds.length > 0) {
      const childEnrollment = await prisma.enrollment.findFirst({
        where: { userId: { in: childIds }, courseId },
        orderBy: { enrolledAt: "asc" },
        select: { userId: true },
      });
      if (childEnrollment) {
        return {
          canAccess: true,
          staff: false,
          enrollment: null,
          preview: false,
          parentViaChild: true,
          progressUserId: childEnrollment.userId,
        };
      }
    }
  }

  return {
    canAccess: false,
    staff: false,
    enrollment: null,
    preview: false,
    parentViaChild: false,
    progressUserId: user.id,
  };
}

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

/** First linked child enrolled in the course (stable order), for parent lesson/course API access. */
export async function getParentProgressUserIdForCourse(
  parentUserId: string,
  organizationId: string,
  courseId: string,
): Promise<string | null> {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId, organizationId },
    select: { studentUserId: true },
  });
  const childIds = links.map((l) => l.studentUserId);
  if (childIds.length === 0) return null;
  const row = await prisma.enrollment.findFirst({
    where: { courseId, userId: { in: childIds } },
    orderBy: { enrolledAt: "asc" },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

export function canEditCourseAsStaff(role: Role): boolean {
  return isStaffRole(role);
}
