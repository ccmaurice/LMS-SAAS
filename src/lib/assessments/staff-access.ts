import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * Courses where a teacher may manage assessments: author, homeroom/extra instructor on a linked class,
 * or chair/instructor on a linked department (higher ed).
 */
export function courseWhereTeacherAssessmentAccess(
  organizationId: string,
  teacherUserId: string,
): Prisma.CourseWhereInput {
  return {
    organizationId,
    OR: [
      { createdById: teacherUserId },
      {
        courseCohorts: {
          some: {
            cohort: {
              OR: [
                { homeroomTeacherId: teacherUserId },
                { instructors: { some: { userId: teacherUserId } } },
              ],
            },
          },
        },
      },
      {
        courseDepartments: {
          some: {
            department: {
              OR: [
                { chairUserId: teacherUserId },
                { instructors: { some: { userId: teacherUserId } } },
              ],
            },
          },
        },
      },
    ],
  };
}

/** Admins: all org courses. Teachers: author or instructing staff on a course linked class/dept. */
export async function canTeacherActOnAssessmentCourse(
  user: { id: string; role: Role; organizationId: string },
  courseId: string,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TEACHER") return false;
  const row = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...courseWhereTeacherAssessmentAccess(user.organizationId, user.id),
    },
    select: { id: true },
  });
  return Boolean(row);
}
