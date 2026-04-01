import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import {
  canTeacherManageCourse,
  getCourseInOrganization,
  getEnrollment,
  getParentProgressUserIdForCourse,
} from "@/lib/courses/access";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(20_000).optional().nullable(),
    published: z.boolean().optional(),
    gradeWeightContinuous: z.number().min(0).max(1).optional(),
    gradeWeightExam: z.number().min(0).max(1).optional(),
    gradingScale: z.enum(["PERCENTAGE", "LETTER_AF", "NUMERIC_10"]).optional(),
    creditHours: z.number().min(0).max(32).optional().nullable(),
    academicTermId: z.union([z.string().min(1), z.null()]).optional(),
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
    include: baseInclude,
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const privilegedStaff = canTeacherManageCourse(user, course.createdById);
  const enrollment = await getEnrollment(user.id, courseId);
  const parentProgressUserId =
    user.role === "PARENT"
      ? await getParentProgressUserIdForCourse(user.id, user.organizationId, courseId)
      : null;

  const studentPreview =
    !privilegedStaff &&
    !enrollment &&
    !parentProgressUserId &&
    user.role === "STUDENT" &&
    course.published;

  const otherTeacherPreview =
    user.role === "TEACHER" &&
    !privilegedStaff &&
    !enrollment &&
    course.published;

  if (
    user.role === "TEACHER" &&
    !privilegedStaff &&
    !enrollment &&
    !course.published
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed =
    privilegedStaff ||
    !!enrollment ||
    !!parentProgressUserId ||
    studentPreview ||
    otherTeacherPreview;

  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let coursePayload: typeof course & {
    enrollments?: { id: string; userId: string; progressPercent: number; enrolledAt: Date }[];
  } = course;

  if (privilegedStaff) {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: { id: true, userId: true, progressPercent: true, enrolledAt: true },
    });
    coursePayload = { ...course, enrollments };
  }

  const preview = studentPreview || otherTeacherPreview;
  const courseOut = preview
    ? {
        ...coursePayload,
        enrollments: undefined,
        modules: coursePayload.modules.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            order: l.order,
            moduleId: l.moduleId,
          })),
        })),
      }
    : coursePayload;

  let lessonProgressIds: string[] = [];
  const progressUserId = enrollment ? user.id : parentProgressUserId;
  if (progressUserId) {
    const progress = await prisma.lessonProgress.findMany({
      where: { userId: progressUserId, lesson: { module: { courseId } } },
      select: { lessonId: true },
    });
    lessonProgressIds = progress.map((p) => p.lessonId);
  }

  return NextResponse.json({
    course: courseOut,
    enrollment,
    lessonProgressIds,
    canEdit: canTeacherManageCourse(user, course.createdById),
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
  if (!canTeacherManageCourse(user, course.createdById)) {
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

  if (parsed.data.academicTermId !== undefined && parsed.data.academicTermId !== null) {
    const term = await prisma.academicTerm.findFirst({
      where: { id: parsed.data.academicTermId, organizationId: user.organizationId },
    });
    if (!term) {
      return NextResponse.json({ error: "Invalid academic term" }, { status: 400 });
    }
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
      ...(parsed.data.creditHours !== undefined && {
        creditHours: parsed.data.creditHours === null ? null : parsed.data.creditHours,
      }),
      ...(parsed.data.academicTermId !== undefined && {
        academicTermId: parsed.data.academicTermId,
      }),
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
  if (!canTeacherManageCourse(user, course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ ok: true });
}
