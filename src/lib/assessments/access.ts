import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";
import { findActiveDraft } from "@/lib/assessments/retake";
import { getStudentCohortIds } from "@/lib/school/cohort-access";
import {
  assessmentVisibleToHeStudentWhere,
  getStudentDepartmentIds,
} from "@/lib/school/department-access";

export async function getAssessmentInOrg(assessmentId: string, organizationId: string) {
  return prisma.assessment.findFirst({
    where: { id: assessmentId, course: { organizationId } },
    include: {
      course: {
        select: {
          id: true,
          createdById: true,
          organizationId: true,
          organization: { select: { educationLevel: true } },
        },
      },
      assessmentCohorts: { select: { cohortId: true } },
      assessmentDepartments: { select: { departmentId: true } },
    },
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

/** Visibility: enrolled + org-level targeting (cohort for K–12, department for HE). */
export async function canStudentViewAssessment(
  userId: string,
  role: Role,
  assessment: {
    published: boolean;
    courseId: string;
    course: {
      organizationId: string;
      organization: { educationLevel: EducationLevel };
    };
    assessmentCohorts: { cohortId: string }[];
    assessmentDepartments: { departmentId: string }[];
  },
): Promise<boolean> {
  if (role === "TEACHER") {
    return canStudentViewAssessment(userId, "STUDENT", assessment);
  }
  if (role !== "STUDENT") return false;
  if (!assessment.published) return false;
  const en = await getEnrollment(userId, assessment.courseId);
  if (!en) return false;

  const level = assessment.course.organization.educationLevel;
  if (level === "HIGHER_ED") {
    const targets = assessment.assessmentDepartments ?? [];
    if (targets.length === 0) return true;
    const studentDepts = await getStudentDepartmentIds(userId, assessment.course.organizationId);
    const targetIds = new Set(targets.map((t) => t.departmentId));
    return studentDepts.some((d) => targetIds.has(d));
  }

  const targets = assessment.assessmentCohorts ?? [];
  if (targets.length === 0) return true;
  const studentCohorts = await getStudentCohortIds(userId, assessment.course.organizationId);
  const targetIds = new Set(targets.map((t) => t.cohortId));
  return studentCohorts.some((cid) => targetIds.has(cid));
}

export async function canStudentTakeAssessment(
  userId: string,
  assessment: {
    published: boolean;
    courseId: string;
    course: {
      organizationId: string;
      organization: { educationLevel: EducationLevel };
    };
    assessmentCohorts: { cohortId: string }[];
    assessmentDepartments: { departmentId: string }[];
  },
): Promise<boolean> {
  return canStudentViewAssessment(userId, "STUDENT", assessment);
}

/**
 * Student may open the take UI: visible assessment, and either attempts are not locked or they already have a draft.
 */
export async function canStudentOpenTakeUi(
  userId: string,
  assessmentId: string,
  assessment: {
    published: boolean;
    studentAttemptsLocked: boolean;
    courseId: string;
    course: {
      organizationId: string;
      organization: { educationLevel: EducationLevel };
    };
    assessmentCohorts: { cohortId: string }[];
    assessmentDepartments: { departmentId: string }[];
  },
): Promise<boolean> {
  if (!(await canStudentTakeAssessment(userId, assessment))) return false;
  if (!assessment.studentAttemptsLocked) return true;
  return Boolean(await findActiveDraft(assessmentId, userId));
}

/** K–12: untargeted or cohort match. */
export function assessmentVisibleToStudentWhere(studentCohortIds: string[]) {
  if (studentCohortIds.length === 0) {
    return { assessmentCohorts: { none: {} } };
  }
  return {
    OR: [
      { assessmentCohorts: { none: {} } },
      { assessmentCohorts: { some: { cohortId: { in: studentCohortIds } } } },
    ],
  };
}

export function assessmentWhereForStudent(
  level: EducationLevel,
  cohortIds: string[],
  departmentIds: string[],
) {
  if (level === "HIGHER_ED") {
    return assessmentVisibleToHeStudentWhere(departmentIds);
  }
  return assessmentVisibleToStudentWhere(cohortIds);
}

/** Prisma `where` fragment: published assessments visible to this student (cohort / department rules). */
export async function assessmentVisibilityWhereForEnrolledStudent(
  studentUserId: string,
  organizationId: string,
): Promise<Prisma.AssessmentWhereInput> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { educationLevel: true },
  });
  const level = org?.educationLevel ?? "SECONDARY";
  const cohortIds = await getStudentCohortIds(studentUserId, organizationId);
  const deptIds = level === "HIGHER_ED" ? await getStudentDepartmentIds(studentUserId, organizationId) : [];
  return assessmentWhereForStudent(level, cohortIds, deptIds) as Prisma.AssessmentWhereInput;
}

export async function countPublishedVisibleAssessmentsForStudent(
  studentUserId: string,
  organizationId: string,
): Promise<number> {
  const vis = await assessmentVisibilityWhereForEnrolledStudent(studentUserId, organizationId);
  return prisma.assessment.count({
    where: {
      published: true,
      course: {
        organizationId,
        enrollments: { some: { userId: studentUserId } },
      },
      ...vis,
    },
  });
}

/** Distinct published assessments any linked child can access (for parent dashboard). */
export async function countPublishedVisibleAssessmentsForParentDistinct(
  parentUserId: string,
  organizationId: string,
): Promise<number> {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId, organizationId },
    select: { studentUserId: true },
  });
  if (links.length === 0) return 0;
  const seen = new Set<string>();
  for (const l of links) {
    const vis = await assessmentVisibilityWhereForEnrolledStudent(l.studentUserId, organizationId);
    const rows = await prisma.assessment.findMany({
      where: {
        published: true,
        course: {
          organizationId,
          enrollments: { some: { userId: l.studentUserId } },
        },
        ...vis,
      },
      select: { id: true },
    });
    for (const r of rows) seen.add(r.id);
  }
  return seen.size;
}
