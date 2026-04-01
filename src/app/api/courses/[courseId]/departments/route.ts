import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { assertCourseInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { userFacultyOfDepartment } from "@/lib/school/department-access";

const postSchema = z.object({
  departmentId: z.string().min(1),
});

export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canTeacherManageCourse(user, course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const links = await prisma.courseDepartment.findMany({
    where: { courseId },
    include: {
      department: {
        select: { id: true, name: true, code: true, facultyDivision: { select: { name: true } } },
      },
    },
    orderBy: { department: { name: "asc" } },
  });

  return NextResponse.json({
    departments: links.map((l) => ({
      ...l.department,
      facultyDivisionName: l.department.facultyDivision?.name ?? null,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: user.organizationId },
    select: { id: true, createdById: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "TEACHER" && course.createdById !== user.id) {
    return NextResponse.json({ error: "Only the course author can link departments" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const dept = await prisma.academicDepartment.findFirst({
    where: { id: parsed.data.departmentId, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!dept) return NextResponse.json({ error: "Department not found" }, { status: 404 });

  if (user.role === "TEACHER" && !(await userFacultyOfDepartment(user.id, dept.id))) {
    return NextResponse.json({ error: "You can only link departments where you are faculty or chair" }, { status: 403 });
  }

  await prisma.courseDepartment.upsert({
    where: { courseId_departmentId: { courseId, departmentId: dept.id } },
    create: { courseId, departmentId: dept.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const departmentId = url.searchParams.get("departmentId");
  if (!departmentId) return NextResponse.json({ error: "departmentId required" }, { status: 400 });

  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: user.organizationId },
    select: { createdById: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "TEACHER" && course.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (user.role === "TEACHER" && !(await userFacultyOfDepartment(user.id, departmentId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.courseDepartment.deleteMany({ where: { courseId, departmentId } });
  return NextResponse.json({ ok: true });
}
