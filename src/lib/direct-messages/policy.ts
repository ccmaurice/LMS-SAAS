import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getStudentCohortIds, getTeacherCohortIds, studentSharesCohortWith } from "@/lib/school/cohort-access";
import {
  getStudentDepartmentIds,
  studentSharesDepartmentWith,
  userFacultyOfDepartment,
} from "@/lib/school/department-access";

export type DmUserRef = {
  id: string;
  role: Role;
  organizationId: string;
};

/** Whether `sender` may start (or use) a DM thread with `recipient` in the same org. */
export async function canOpenDirectThread(sender: DmUserRef, recipient: DmUserRef): Promise<boolean> {
  if (sender.organizationId !== recipient.organizationId || sender.id === recipient.id) {
    return false;
  }

  const sr = sender.role;
  const rr = recipient.role;

  if (sr === "STUDENT") {
    if (rr === "STUDENT") return sharedCourseEnrollment(sender.id, recipient.id);
    if (rr === "TEACHER") return studentLinkedToTeacher(sender.id, recipient.id);
    if (rr === "ADMIN") return true;
    return false;
  }

  if (sr === "PARENT") {
    if (rr === "ADMIN") return true;
    if (rr === "TEACHER") return parentLinkedToTeacher(sender.id, recipient.id, sender.organizationId);
    if (rr === "STUDENT") return parentLinkedToStudent(sender.id, recipient.id);
    return false;
  }

  if (sr === "TEACHER") {
    if (rr === "ADMIN") return true;
    if (rr === "STUDENT") return teacherLinkedToStudent(sender.id, recipient.id);
    if (rr === "TEACHER") return true;
    if (rr === "PARENT") return teacherLinkedToParent(sender.id, recipient.id, sender.organizationId);
    return false;
  }

  if (sr === "ADMIN") {
    return rr === "TEACHER" || rr === "STUDENT" || rr === "PARENT";
  }

  return false;
}

async function sharedCourseEnrollment(studentA: string, studentB: string): Promise<boolean> {
  const aCourses = await prisma.enrollment.findMany({
    where: { userId: studentA },
    select: { courseId: true },
  });
  const ids = aCourses.map((e) => e.courseId);
  if (ids.length > 0) {
    const shared = await prisma.enrollment.findFirst({
      where: { userId: studentB, courseId: { in: ids } },
      select: { id: true },
    });
    if (shared) return true;
  }
  const org = await prisma.user.findUnique({
    where: { id: studentA },
    select: { organizationId: true },
  });
  if (!org) return false;
  const edu = await prisma.organization.findUnique({
    where: { id: org.organizationId },
    select: { educationLevel: true },
  });
  if (edu?.educationLevel === "HIGHER_ED") {
    if (await studentSharesDepartmentWith(studentA, studentB, org.organizationId)) return true;
  }
  return studentSharesCohortWith(studentA, studentB, org.organizationId);
}

/** Student is enrolled in a course authored by the teacher. */
async function studentLinkedToTeacher(studentId: string, teacherId: string): Promise<boolean> {
  const row = await prisma.enrollment.findFirst({
    where: {
      userId: studentId,
      course: { createdById: teacherId },
    },
    select: { id: true },
  });
  if (row) return true;
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { organizationId: true },
  });
  if (!student) return false;
  const edu = await prisma.organization.findUnique({
    where: { id: student.organizationId },
    select: { educationLevel: true },
  });
  if (edu?.educationLevel === "HIGHER_ED") {
    const depts = await getStudentDepartmentIds(studentId, student.organizationId);
    for (const d of depts) {
      if (await userFacultyOfDepartment(teacherId, d)) return true;
    }
    return false;
  }
  const teacherCohorts = await getTeacherCohortIds(teacherId, student.organizationId);
  if (teacherCohorts.length === 0) return false;
  const studentCohorts = await getStudentCohortIds(studentId, student.organizationId);
  return studentCohorts.some((c) => teacherCohorts.includes(c));
}

/** Student is enrolled in a course authored by the teacher. */
async function teacherLinkedToStudent(teacherId: string, studentId: string): Promise<boolean> {
  return studentLinkedToTeacher(studentId, teacherId);
}

async function parentLinkedToStudent(parentId: string, studentId: string): Promise<boolean> {
  const row = await prisma.parentStudentLink.findFirst({
    where: { parentUserId: parentId, studentUserId: studentId },
    select: { id: true },
  });
  return !!row;
}

async function parentLinkedToTeacher(
  parentId: string,
  teacherId: string,
  organizationId: string,
): Promise<boolean> {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId: parentId, organizationId },
    select: { studentUserId: true },
  });
  const ids = links.map((l) => l.studentUserId);
  if (ids.length === 0) return false;
  const row = await prisma.enrollment.findFirst({
    where: { userId: { in: ids }, course: { createdById: teacherId } },
    select: { id: true },
  });
  if (row) return true;
  const edu = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { educationLevel: true },
  });
  if (edu?.educationLevel !== "HIGHER_ED") return false;
  for (const sid of ids) {
    const depts = await getStudentDepartmentIds(sid, organizationId);
    for (const d of depts) {
      if (await userFacultyOfDepartment(teacherId, d)) return true;
    }
  }
  return false;
}

async function teacherLinkedToParent(teacherId: string, parentId: string, organizationId: string): Promise<boolean> {
  return parentLinkedToTeacher(parentId, teacherId, organizationId);
}
