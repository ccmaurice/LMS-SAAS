import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canTeacherManageCourse, getModuleInOrganization } from "@/lib/courses/access";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(100_000).optional().nullable(),
  videoUrl: z.union([z.string().url().max(2000), z.literal("")]).optional().nullable(),
  order: z.number().int().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const mod = await getModuleInOrganization(moduleId, user.organizationId);
  if (!mod) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canTeacherManageCourse(user, mod.course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const maxOrder = await prisma.lesson.aggregate({
    where: { moduleId },
    _max: { order: true },
  });
  const order = parsed.data.order ?? (maxOrder._max.order ?? -1) + 1;

  const videoUrl =
    parsed.data.videoUrl === "" || parsed.data.videoUrl === undefined || parsed.data.videoUrl === null
      ? null
      : parsed.data.videoUrl;

  const lesson = await prisma.lesson.create({
    data: {
      moduleId,
      title: parsed.data.title.trim(),
      content: parsed.data.content?.trim() || null,
      videoUrl,
      order,
    },
  });

  return NextResponse.json({
    lesson: { ...lesson, files: [] as { id: string; name: string; url: string }[] },
  });
}
