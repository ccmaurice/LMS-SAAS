import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getStudentCohortIds, getTeacherCohortIds } from "@/lib/school/cohort-access";
import {
  getDepartmentFacultyUserIds,
  getFacultyDepartmentIds,
  getStudentDepartmentIds,
} from "@/lib/school/department-access";

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
        role: { in: ["TEACHER", "STUDENT", "PARENT"] },
      },
      select,
    });
    return rows.sort(sortRecipients);
  }

  if (viewer.role === "TEACHER") {
    const [admins, enrollRows, otherTeachers, orgEdu] = await Promise.all([
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
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { educationLevel: true },
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
    const instructCohortIds = await getTeacherCohortIds(viewer.id, orgId);
    const cohortStudents =
      instructCohortIds.length === 0
        ? []
        : await prisma.cohortMembership
            .findMany({
              where: { cohortId: { in: instructCohortIds } },
              distinct: ["userId"],
              select: { userId: true },
            })
            .then(async (memb) => {
              const sids = memb.map((m) => m.userId).filter((id) => id !== viewer.id);
              if (sids.length === 0) return [];
              return prisma.user.findMany({
                where: { id: { in: sids }, organizationId: orgId, role: "STUDENT" },
                select,
              });
            });
    let departmentStudents: EligibleRecipient[] = [];
    if (orgEdu?.educationLevel === "HIGHER_ED") {
      const facDeptIds = await getFacultyDepartmentIds(viewer.id, orgId);
      if (facDeptIds.length > 0) {
        departmentStudents = await prisma.studentDepartmentAffiliation
          .findMany({
            where: { departmentId: { in: facDeptIds } },
            distinct: ["userId"],
            select: { userId: true },
          })
          .then(async (memb) => {
            const sids = memb.map((m) => m.userId).filter((id) => id !== viewer.id);
            if (sids.length === 0) return [];
            return prisma.user.findMany({
              where: { id: { in: sids }, organizationId: orgId, role: "STUDENT" },
              select,
            });
          });
      }
    }
    const map = new Map<string, EligibleRecipient>();
    for (const u of admins) map.set(u.id, u);
    for (const u of otherTeachers) map.set(u.id, u);
    for (const u of students) map.set(u.id, u);
    for (const u of cohortStudents) map.set(u.id, u);
    for (const u of departmentStudents) map.set(u.id, u);
    return [...map.values()].sort(sortRecipients);
  }

  if (viewer.role === "PARENT") {
    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: viewer.id, organizationId: orgId },
      select: { studentUserId: true },
    });
    const studentIds = links.map((l) => l.studentUserId);
    const [admins, enrollments, orgEdu] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, role: "ADMIN" },
        select,
      }),
      studentIds.length === 0
        ? []
        : prisma.enrollment.findMany({
            where: { userId: { in: studentIds } },
            select: { courseId: true },
          }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { educationLevel: true },
      }),
    ]);
    const map = new Map<string, EligibleRecipient>();
    for (const u of admins) map.set(u.id, u);
    const courseIds = [...new Set(enrollments.map((e) => e.courseId))];
    if (courseIds.length > 0) {
      const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { createdById: true },
      });
      const teacherIds = [...new Set(courses.map((c) => c.createdById))];
      if (teacherIds.length > 0) {
        const teachers = await prisma.user.findMany({
          where: { id: { in: teacherIds }, organizationId: orgId, role: "TEACHER" },
          select,
        });
        for (const u of teachers) map.set(u.id, u);
      }
    }
    if (orgEdu?.educationLevel === "HIGHER_ED" && studentIds.length > 0) {
      const deptFacultyIds = new Set<string>();
      for (const sid of studentIds) {
        const depts = await getStudentDepartmentIds(sid, orgId);
        for (const d of depts) {
          for (const uid of await getDepartmentFacultyUserIds(d)) {
            deptFacultyIds.add(uid);
          }
        }
      }
      deptFacultyIds.delete(viewer.id);
      if (deptFacultyIds.size > 0) {
        const deptTeachers = await prisma.user.findMany({
          where: {
            id: { in: [...deptFacultyIds] },
            organizationId: orgId,
            role: "TEACHER",
          },
          select,
        });
        for (const u of deptTeachers) map.set(u.id, u);
      }
    }
    return [...map.values()].sort(sortRecipients);
  }

  // STUDENT — org admins + teachers of their courses + classmates
  const [admins, myEnrollments, orgEdu] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, role: "ADMIN" },
      select,
    }),
    prisma.enrollment.findMany({
      where: { userId: viewer.id },
      select: { courseId: true },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { educationLevel: true },
    }),
  ]);

  const map = new Map<string, EligibleRecipient>();
  for (const u of admins) map.set(u.id, u);

  const isHe = orgEdu?.educationLevel === "HIGHER_ED";
  const courseIds = myEnrollments.map((e) => e.courseId);
  if (courseIds.length === 0) {
    if (!isHe) return [...map.values()].sort(sortRecipients);
    const myDepts = await getStudentDepartmentIds(viewer.id, orgId);
    const facultyIds = new Set<string>();
    for (const d of myDepts) {
      for (const uid of await getDepartmentFacultyUserIds(d)) {
        if (uid !== viewer.id) facultyIds.add(uid);
      }
    }
    if (facultyIds.size > 0) {
      const deptTeachers = await prisma.user.findMany({
        where: {
          id: { in: [...facultyIds] },
          organizationId: orgId,
          role: "TEACHER",
        },
        select,
      });
      for (const u of deptTeachers) map.set(u.id, u);
    }
    const deptMateRows =
      myDepts.length === 0
        ? []
        : await prisma.studentDepartmentAffiliation.findMany({
            where: { departmentId: { in: myDepts }, userId: { not: viewer.id } },
            distinct: ["userId"],
            select: { userId: true },
          });
    const mateIds = deptMateRows.map((r) => r.userId);
    if (mateIds.length > 0) {
      const deptMates = await prisma.user.findMany({
        where: { id: { in: mateIds }, organizationId: orgId, role: "STUDENT" },
        select,
      });
      for (const u of deptMates) map.set(u.id, u);
    }
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

  const myCohortIds = await getStudentCohortIds(viewer.id, orgId);
  const cohortClassmates =
    myCohortIds.length === 0
      ? []
      : await prisma.cohortMembership
          .findMany({
            where: { cohortId: { in: myCohortIds }, userId: { not: viewer.id } },
            distinct: ["userId"],
            select: { userId: true },
          })
          .then(async (memb) => {
            const oids = memb.map((m) => m.userId);
            if (oids.length === 0) return [];
            return prisma.user.findMany({
              where: { id: { in: oids }, organizationId: orgId, role: "STUDENT" },
              select,
            });
          });

  let deptFacultyExtra: EligibleRecipient[] = [];
  let departmentClassmates: EligibleRecipient[] = [];
  if (isHe) {
    const myDeptIds = await getStudentDepartmentIds(viewer.id, orgId);
    const facIds = new Set<string>();
    for (const d of myDeptIds) {
      for (const uid of await getDepartmentFacultyUserIds(d)) {
        if (uid !== viewer.id && !teacherIds.includes(uid)) facIds.add(uid);
      }
    }
    if (facIds.size > 0) {
      deptFacultyExtra = await prisma.user.findMany({
        where: { id: { in: [...facIds] }, organizationId: orgId, role: "TEACHER" },
        select,
      });
    }
    if (myDeptIds.length > 0) {
      departmentClassmates = await prisma.studentDepartmentAffiliation
        .findMany({
          where: { departmentId: { in: myDeptIds }, userId: { not: viewer.id } },
          distinct: ["userId"],
          select: { userId: true },
        })
        .then(async (memb) => {
          const oids = memb.map((m) => m.userId);
          if (oids.length === 0) return [];
          return prisma.user.findMany({
            where: { id: { in: oids }, organizationId: orgId, role: "STUDENT" },
            select,
          });
        });
    }
  }

  for (const u of teachers) map.set(u.id, u);
  for (const u of classmates) map.set(u.id, u);
  for (const u of cohortClassmates) map.set(u.id, u);
  for (const u of deptFacultyExtra) map.set(u.id, u);
  for (const u of departmentClassmates) map.set(u.id, u);
  return [...map.values()].sort(sortRecipients);
}
