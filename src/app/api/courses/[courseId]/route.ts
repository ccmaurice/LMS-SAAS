import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canEditCourseAsStaff, getCourseInOrganization, getEnrollment, isStaffRole } from "@/lib/courses/access";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(20_000).optional().nullable(),
    published: z.boolean().optional(),
    gradeWeightContinuous: z.number().min(0).max(1).optional(),
    gradeWeightExam: z.number().min(0).max(1).optional(),
    gradingScale: z.enum(["PERCENTAGE", "LETTER_AF", "NUMERIC_10"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.gradeWeightContinuous != null && data.gradeWeightExam != null) {
      const s = data.gradeWeightContinuous + data.gradeWeightExam;
      if (Math.abs(s - 1) > 0.001) {
        ctx.addIssue({
          code: "custom",
          message: "gradeWeightContinuous + gradeWeightExam must equal 1",
        });
      }
    }
  });

export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const baseInclude = {
    createdBy: { select: { id: true, name: true, email: true } },
    modules: {
      orderBy: { order: "asc" as const },
      include: {
        lessons: { orderBy: { order: "asc" as const }, include: { files: true } },
      },
    },
  };

  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: user.organizationId },
    include: {
      ...baseInclude,
      ...(isStaffRole(user.role)
        ? { enrollments: { select: { id: true, userId: true, progressPercent: true, enrolledAt: true } } }
        : {}),
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const enrollment = await getEnrollment(user.id, courseId);
  const staff = isStaffRole(user.role);

  if (!staff && !enrollment && !(user.role === "STUDENT" && course.published)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let lessonProgressIds: string[] = [];
  if (enrollment) {
    const progress = await prisma.lessonProgress.findMany({
      where: { userId: user.id, lesson: { module: { courseId } } },
      select: { lessonId: true },
    });
    lessonProgressIds = progress.map((p) => p.lessonId);
  }

  const preview = !staff && !enrollment && user.role === "STUDENT" && course.published;
  const courseOut = preview
    ? {
        ...course,
        modules: course.modules.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            order: l.order,
            moduleId: l.moduleId,
          })),
        })),
      }
    : course;

  return NextResponse.json({
    course: courseOut,
    enrollment,
    lessonProgressIds,
    canEdit: canEditCourseAsStaff(user.role),
    preview,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const course = await getCourseInOrganization(courseId, user.organizationId);
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditCourseAsStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description === null ? null : parsed.data.description.trim(),
      }),
      ...(parsed.data.published !== undefined && { published: parsed.data.published }),
      ...(parsed.data.gradeWeightContinuous !== undefined && {
        gradeWeightContinuous: parsed.data.gradeWeightContinuous,
      }),
      ...(parsed.data.gradeWeightExam !== undefined && { gradeWeightExam: parsed.data.gradeWeightExam }),
      ...(parsed.data.gradingScale !== undefined && { gradingScale: parsed.data.gradingScale }),
    },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { files: true } } },
      },
    },
  });

  return NextResponse.json({ course: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const course = await getCourseInOrganization(courseId, user.organizationId);
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditCourseAsStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ ok: true });
}
