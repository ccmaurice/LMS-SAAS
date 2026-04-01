import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { isStaffRole } from "@/lib/courses/access";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).optional().nullable(),
  published: z.boolean().optional(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  if (isStaffRole(user.role)) {
    const staffWhere: Prisma.CourseWhereInput =
      user.role === "ADMIN"
        ? { organizationId: user.organizationId }
        : {
            organizationId: user.organizationId,
            OR: [{ published: true }, { createdById: user.id }],
          };
    const courses = await prisma.course.findMany({
      where: staffWhere,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { enrollments: true, modules: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ scope: "staff" as const, courses });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          _count: { select: { modules: true } },
        },
      },
    },
  });

  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const catalog = await prisma.course.findMany({
    where: {
      organizationId: user.organizationId,
      published: true,
      id: { notIn: [...enrolledIds] },
    },
    orderBy: { title: "asc" },
    include: { _count: { select: { modules: true } } },
  });

  return NextResponse.json({
    scope: "student" as const,
    enrollments,
    catalog,
  });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const course = await prisma.course.create({
    data: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      published: parsed.data.published ?? false,
      organizationId: user.organizationId,
      createdById: user.id,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ course });
}
