import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { assertCourseInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { userInstructsCohort } from "@/lib/school/cohort-access";

const postSchema = z.object({
  cohortId: z.string().min(1),
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

  const links = await prisma.courseCohort.findMany({
    where: { courseId },
    include: {
      cohort: {
        select: { id: true, name: true, gradeLabel: true, academicYearLabel: true },
      },
    },
    orderBy: { cohort: { name: "asc" } },
  });

  return NextResponse.json({
    cohorts: links.map((l) => l.cohort),
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
    return NextResponse.json({ error: "Only the course author can link classes" }, { status: 403 });
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

  const cohort = await prisma.schoolCohort.findFirst({
    where: { id: parsed.data.cohortId, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!cohort) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  if (user.role === "TEACHER" && !(await userInstructsCohort(user.id, cohort.id))) {
    return NextResponse.json({ error: "You can only link classes you teach" }, { status: 403 });
  }

  await prisma.courseCohort.upsert({
    where: { courseId_cohortId: { courseId, cohortId: cohort.id } },
    create: { courseId, cohortId: cohort.id },
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
  const cohortId = url.searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: user.organizationId },
    select: { createdById: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "TEACHER" && course.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (user.role === "TEACHER" && !(await userInstructsCohort(user.id, cohortId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.courseCohort.deleteMany({ where: { courseId, cohortId } });
  return NextResponse.json({ ok: true });
}
