import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { isStaffRole } from "@/lib/courses/access";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  body: z.string().min(1).max(200_000).optional(),
  published: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const { postId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const post = await prisma.blogPost.findFirst({
    where: { id: postId, organizationId: user.organizationId },
    include: { author: { select: { name: true, email: true } } },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!post.published && !isStaffRole(user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const { postId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await prisma.blogPost.findFirst({
    where: { id: postId, organizationId: user.organizationId },
  });
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

  const post = await prisma.blogPost.update({
    where: { id: postId },
    data: {
      ...(parsed.data.title != null ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.excerpt !== undefined ? { excerpt: parsed.data.excerpt?.trim() || null } : {}),
      ...(parsed.data.body != null ? { body: parsed.data.body } : {}),
      ...(parsed.data.published != null ? { published: parsed.data.published } : {}),
    },
    include: { author: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ post });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const { postId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const existing = await prisma.blogPost.findFirst({
    where: { id: postId, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.blogPost.delete({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}
