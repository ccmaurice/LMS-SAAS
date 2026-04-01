import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export async function listStaffCourses(organizationId: string, viewer: { id: string; role: Role }) {
  const where =
    viewer.role === "ADMIN"
      ? { organizationId }
      : {
          organizationId,
          OR: [{ published: true }, { createdById: viewer.id }],
        };

  return prisma.course.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { enrollments: true, modules: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
}

export async function listStudentCourses(userId: string, organizationId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, course: { organizationId } },
    include: {
      course: {
        include: { _count: { select: { modules: true } } },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const catalog = await prisma.course.findMany({
    where: {
      organizationId,
      published: true,
      id: { notIn: [...enrolledIds] },
    },
    orderBy: { title: "asc" },
    include: { _count: { select: { modules: true } } },
  });

  return { enrollments, catalog };
}
