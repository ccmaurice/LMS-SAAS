import { prisma } from "@/lib/db";

/** Homeroom + explicit CohortInstructor rows. */
export async function getCohortInstructorUserIds(cohortId: string): Promise<string[]> {
  const cohort = await prisma.schoolCohort.findUnique({
    where: { id: cohortId },
    select: {
      homeroomTeacherId: true,
      instructors: { select: { userId: true } },
    },
  });
  if (!cohort) return [];
  const ids = new Set<string>();
  if (cohort.homeroomTeacherId) ids.add(cohort.homeroomTeacherId);
  for (const i of cohort.instructors) ids.add(i.userId);
  return [...ids];
}

export async function userInstructsCohort(userId: string, cohortId: string): Promise<boolean> {
  const ids = await getCohortInstructorUserIds(cohortId);
  return ids.includes(userId);
}

/** Cohorts the user teaches (homeroom or additional instructor). */
export async function getTeacherCohortIds(teacherUserId: string, organizationId: string): Promise<string[]> {
  const asHomeroom = await prisma.schoolCohort.findMany({
    where: { organizationId, homeroomTeacherId: teacherUserId },
    select: { id: true },
  });
  const asExtra = await prisma.cohortInstructor.findMany({
    where: { userId: teacherUserId, cohort: { organizationId } },
    select: { cohortId: true },
  });
  const set = new Set<string>();
  for (const r of asHomeroom) set.add(r.id);
  for (const r of asExtra) set.add(r.cohortId);
  return [...set];
}

export async function getStudentCohortIds(studentUserId: string, organizationId: string): Promise<string[]> {
  const rows = await prisma.cohortMembership.findMany({
    where: { userId: studentUserId, cohort: { organizationId } },
    select: { cohortId: true },
  });
  return rows.map((r) => r.cohortId);
}

export async function studentSharesCohortWith(studentA: string, studentB: string, organizationId: string): Promise<boolean> {
  const a = await getStudentCohortIds(studentA, organizationId);
  if (a.length === 0) return false;
  const row = await prisma.cohortMembership.findFirst({
    where: { userId: studentB, cohortId: { in: a } },
    select: { cohortId: true },
  });
  return !!row;
}

/** Read class messages: member, instructor, or org admin. */
export async function canReadCohortMessages(
  userId: string,
  role: string,
  cohortId: string,
  organizationId: string,
): Promise<boolean> {
  if (role === "ADMIN") {
    const c = await prisma.schoolCohort.findFirst({
      where: { id: cohortId, organizationId },
      select: { id: true },
    });
    return !!c;
  }
  const member = await prisma.cohortMembership.findUnique({
    where: { cohortId_userId: { cohortId, userId } },
    select: { cohortId: true },
  });
  if (member) return true;
  if (role === "TEACHER") {
    return userInstructsCohort(userId, cohortId);
  }
  return false;
}

/** Post class messages: org admin or teacher assigned to the class. */
export async function canPostCohortMessage(
  userId: string,
  role: string,
  cohortId: string,
  organizationId: string,
): Promise<boolean> {
  if (role === "ADMIN") {
    const c = await prisma.schoolCohort.findFirst({
      where: { id: cohortId, organizationId },
      select: { id: true },
    });
    return !!c;
  }
  if (role === "TEACHER") {
    return userInstructsCohort(userId, cohortId);
  }
  return false;
}

export async function syncHomeroomAsInstructor(cohortId: string, homeroomTeacherId: string | null) {
  if (!homeroomTeacherId) return;
  await prisma.cohortInstructor.upsert({
    where: { cohortId_userId: { cohortId, userId: homeroomTeacherId } },
    create: { cohortId, userId: homeroomTeacherId },
    update: {},
  });
}
