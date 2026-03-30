import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getLearningResourceInOrg } from "@/lib/learning-resources/access";
import { removeUpload } from "@/lib/uploads/storage";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  externalUrl: z.string().url().optional().nullable(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getLearningResourceInOrg(resourceId, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const resource = await prisma.learningResource.update({
    where: { id: resourceId },
    data: {
      ...(parsed.data.title != null ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description?.trim() || null } : {}),
      ...(parsed.data.externalUrl !== undefined ? { externalUrl: parsed.data.externalUrl?.trim() || null } : {}),
      ...(parsed.data.published != null ? { published: parsed.data.published } : {}),
      ...(parsed.data.sortOrder != null ? { sortOrder: parsed.data.sortOrder } : {}),
    },
    select: { id: true, title: true, kind: true, published: true },
  });

  return NextResponse.json({ resource });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getLearningResourceInOrg(resourceId, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.storageKey) {
    await removeUpload(existing.storageKey);
  }

  await prisma.learningResource.delete({ where: { id: resourceId } });
  return NextResponse.json({ ok: true });
}
