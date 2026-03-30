import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

const select = { id: true, name: true, email: true, role: true } as const;

export type EligibleRecipient = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

function sortRecipients(a: EligibleRecipient, b: EligibleRecipient): number {
  const r = a.role.localeCompare(b.role);
  if (r !== 0) return r;
  return a.email.localeCompare(b.email);
}

/** Users the viewer may start a new DM with (same rules as `canOpenDirectThread`). */
export async function listEligibleDmRecipients(viewer: {
  id: string;
  role: Role;
  organizationId: string;
}): Promise<EligibleRecipient[]> {
  const orgId = viewer.organizationId;

  if (viewer.role === "ADMIN") {
    const rows = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        id: { not: viewer.id },
        role: { in: ["TEACHER", "STUDENT"] },
      },
      select,
    });
    return rows.sort(sortRecipients);
  }

  if (viewer.role === "TEACHER") {
    const [admins, enrollRows, otherTeachers] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, role: "ADMIN" },
        select,
      }),
      prisma.enrollment.findMany({
        where: { course: { createdById: viewer.id } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, role: "TEACHER", id: { not: viewer.id } },
        select,
      }),
    ]);
    const studentIds = enrollRows.map((e) => e.userId).filter((id) => id !== viewer.id);
    const students =
      studentIds.length === 0
        ? []
        : await prisma.user.findMany({
            where: { id: { in: studentIds }, organizationId: orgId, role: "STUDENT" },
            select,
          });
    const map = new Map<string, EligibleRecipient>();
    for (const u of admins) map.set(u.id, u);
    for (const u of otherTeachers) map.set(u.id, u);
    for (const u of students) map.set(u.id, u);
    return [...map.values()].sort(sortRecipients);
  }

  // STUDENT — org admins + teachers of their courses + classmates
  const [admins, myEnrollments] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, role: "ADMIN" },
      select,
    }),
    prisma.enrollment.findMany({
      where: { userId: viewer.id },
      select: { courseId: true },
    }),
  ]);

  const map = new Map<string, EligibleRecipient>();
  for (const u of admins) map.set(u.id, u);

  const courseIds = myEnrollments.map((e) => e.courseId);
  if (courseIds.length === 0) {
    return [...map.values()].sort(sortRecipients);
  }

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { createdById: true },
  });
  const teacherIds = [...new Set(courses.map((c) => c.createdById))];

  const [teachers, classmateEnrollments] = await Promise.all([
    teacherIds.length === 0
      ? []
      : prisma.user.findMany({
          where: { id: { in: teacherIds }, organizationId: orgId, role: "TEACHER" },
          select,
        }),
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, userId: { not: viewer.id } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const classmateIds = classmateEnrollments.map((e) => e.userId);
  const classmates =
    classmateIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: classmateIds }, organizationId: orgId, role: "STUDENT" },
          select,
        });

  for (const u of teachers) map.set(u.id, u);
  for (const u of classmates) map.set(u.id, u);
  return [...map.values()].sort(sortRecipients);
}
