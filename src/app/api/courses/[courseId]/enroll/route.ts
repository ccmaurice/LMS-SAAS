import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { getCourseInOrganization, getEnrollment, isStaffRole } from "@/lib/courses/access";

export async function POST(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const course = await getCourseInOrganization(courseId, user.organizationId);
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!course.published && !isStaffRole(user.role)) {
    return NextResponse.json({ error: "Course is not open for enrollment" }, { status: 403 });
  }

  const existing = await getEnrollment(user.id, courseId);
  if (existing) {
    return NextResponse.json({ enrollment: existing });
  }

  const enrollment = await prisma.enrollment.create({
    data: { userId: user.id, courseId },
  });

  const courseMeta = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      createdById: true,
      organization: { select: { slug: true } },
    },
  });
  const enrollingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true },
  });
  if (
    courseMeta?.createdById &&
    enrollingUser &&
    courseMeta.createdById !== user.id
  ) {
    await prisma.notification.create({
      data: {
        userId: courseMeta.createdById,
        title: "New enrollment",
        body: `${enrollingUser.name ?? enrollingUser.email} enrolled in ${courseMeta.title}.`,
        link: `/o/${courseMeta.organization.slug}/courses/${courseId}`,
      },
    });
  }

  return NextResponse.json({ enrollment });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const course = await getCourseInOrganization(courseId, user.organizationId);
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.enrollment.deleteMany({ where: { userId: user.id, courseId } });
  await prisma.lessonProgress.deleteMany({
    where: { userId: user.id, lesson: { module: { courseId } } },
  });

  return NextResponse.json({ ok: true });
}
