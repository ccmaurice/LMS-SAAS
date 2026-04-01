import { prisma } from "@/lib/db";

/** Chair + explicit department instructors. */
export async function getDepartmentFacultyUserIds(departmentId: string): Promise<string[]> {
  const dept = await prisma.academicDepartment.findUnique({
    where: { id: departmentId },
    select: {
      chairUserId: true,
      instructors: { select: { userId: true } },
    },
  });
  if (!dept) return [];
  const ids = new Set<string>();
  if (dept.chairUserId) ids.add(dept.chairUserId);
  for (const i of dept.instructors) ids.add(i.userId);
  return [...ids];
}

export async function userFacultyOfDepartment(userId: string, departmentId: string): Promise<boolean> {
  const ids = await getDepartmentFacultyUserIds(departmentId);
  return ids.includes(userId);
}

export async function getFacultyDepartmentIds(teacherUserId: string, organizationId: string): Promise<string[]> {
  const asChair = await prisma.academicDepartment.findMany({
    where: { organizationId, chairUserId: teacherUserId },
    select: { id: true },
  });
  const asInstructor = await prisma.departmentInstructor.findMany({
    where: { userId: teacherUserId, department: { organizationId } },
    select: { departmentId: true },
  });
  const set = new Set<string>();
  for (const r of asChair) set.add(r.id);
  for (const r of asInstructor) set.add(r.departmentId);
  return [...set];
}

export async function getStudentDepartmentIds(studentUserId: string, organizationId: string): Promise<string[]> {
  const rows = await prisma.studentDepartmentAffiliation.findMany({
    where: { userId: studentUserId, department: { organizationId } },
    select: { departmentId: true },
  });
  return rows.map((r) => r.departmentId);
}

export async function studentSharesDepartmentWith(
  studentA: string,
  studentB: string,
  organizationId: string,
): Promise<boolean> {
  const a = await getStudentDepartmentIds(studentA, organizationId);
  if (a.length === 0) return false;
  const row = await prisma.studentDepartmentAffiliation.findFirst({
    where: { userId: studentB, departmentId: { in: a } },
    select: { departmentId: true },
  });
  return !!row;
}

export async function canReadDepartmentMessages(
  userId: string,
  role: string,
  departmentId: string,
  organizationId: string,
): Promise<boolean> {
  if (role === "ADMIN") {
    const d = await prisma.academicDepartment.findFirst({
      where: { id: departmentId, organizationId },
      select: { id: true },
    });
    return !!d;
  }
  const aff = await prisma.studentDepartmentAffiliation.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
    select: { departmentId: true },
  });
  if (aff) return true;
  if (role === "TEACHER") {
    return userFacultyOfDepartment(userId, departmentId);
  }
  return false;
}

export async function canPostDepartmentMessage(
  userId: string,
  role: string,
  departmentId: string,
  organizationId: string,
): Promise<boolean> {
  if (role === "ADMIN") {
    const d = await prisma.academicDepartment.findFirst({
      where: { id: departmentId, organizationId },
      select: { id: true },
    });
    return !!d;
  }
  if (role === "TEACHER") {
    return userFacultyOfDepartment(userId, departmentId);
  }
  return false;
}

/** Prisma fragment: HE student sees untargeted assessments or those assigned to one of their departments. */
export function assessmentVisibleToHeStudentWhere(departmentIds: string[]) {
  if (departmentIds.length === 0) {
    return { assessmentDepartments: { none: {} } };
  }
  return {
    OR: [
      { assessmentDepartments: { none: {} } },
      { assessmentDepartments: { some: { departmentId: { in: departmentIds } } } },
    ],
  };
}
