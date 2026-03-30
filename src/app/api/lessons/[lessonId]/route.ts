import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canEditCourseAsStaff, getEnrollment, getLessonInOrganization, isStaffRole } from "@/lib/courses/access";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100_000).optional().nullable(),
  videoUrl: z.union([z.string().url().max(2000), z.literal("")]).optional().nullable(),
  order: z.number().int().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const lesson = await getLessonInOrganization(lessonId, user.organizationId);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const courseId = lesson.module.courseId;
  const enrollment = await getEnrollment(user.id, courseId);
  const staff = isStaffRole(user.role);
  const course = lesson.module.course;

  if (!staff && !enrollment) {
    if (user.role === "STUDENT" && course.published) {
      return NextResponse.json({
        lesson: {
          id: lesson.id,
          title: lesson.title,
          order: lesson.order,
          moduleId: lesson.moduleId,
        },
        preview: true,
      });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const full = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { files: true, module: { select: { id: true, title: true, courseId: true } } },
  });

  let completed = false;
  if (enrollment) {
    const p = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
    });
    completed = !!p;
  }

  return NextResponse.json({ lesson: full, preview: false, completed });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const lesson = await getLessonInOrganization(lessonId, user.organizationId);
  if (!lesson) {
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

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.content !== undefined && {
        content: parsed.data.content === null ? null : parsed.data.content.trim(),
      }),
      ...(parsed.data.videoUrl !== undefined && {
        videoUrl:
          parsed.data.videoUrl === "" || parsed.data.videoUrl === null ? null : parsed.data.videoUrl,
      }),
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  return NextResponse.json({ lesson: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const lesson = await getLessonInOrganization(lessonId, user.organizationId);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditCourseAsStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.lesson.delete({ where: { id: lessonId } });
  return NextResponse.json({ ok: true });
}
