import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

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

  if (sr === "TEACHER") {
    if (rr === "ADMIN") return true;
    if (rr === "STUDENT") return teacherLinkedToStudent(sender.id, recipient.id);
    if (rr === "TEACHER") return true;
    return false;
  }

  if (sr === "ADMIN") {
    return rr === "TEACHER" || rr === "STUDENT";
  }

  return false;
}

async function sharedCourseEnrollment(studentA: string, studentB: string): Promise<boolean> {
  const aCourses = await prisma.enrollment.findMany({
    where: { userId: studentA },
    select: { courseId: true },
  });
  const ids = aCourses.map((e) => e.courseId);
  if (ids.length === 0) return false;
  const shared = await prisma.enrollment.findFirst({
    where: { userId: studentB, courseId: { in: ids } },
    select: { id: true },
  });
  return !!shared;
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
  return !!row;
}

/** Student is enrolled in a course authored by the teacher. */
async function teacherLinkedToStudent(teacherId: string, studentId: string): Promise<boolean> {
  return studentLinkedToTeacher(studentId, teacherId);
}
