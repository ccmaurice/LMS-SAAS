import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canTeacherManageCourse, getModuleInOrganization } from "@/lib/courses/access";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await prisma.module.update({
    where: { id: moduleId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  return NextResponse.json({ module: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
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

  await prisma.module.delete({ where: { id: moduleId } });
  return NextResponse.json({ ok: true });
}
