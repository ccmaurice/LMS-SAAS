import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canPostDepartmentMessage, canReadDepartmentMessages } from "@/lib/school/department-access";

const postSchema = z.object({
  body: z.string().min(1).max(8000),
});

export async function GET(_req: Request, ctx: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const ok = await canReadDepartmentMessages(user.id, user.role, departmentId, user.organizationId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = await prisma.departmentMessage.findMany({
    where: { departmentId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      sender: m.user,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const canPost = await canPostDepartmentMessage(user.id, user.role, departmentId, user.organizationId);
  if (!canPost) {
    return NextResponse.json({ error: "Only faculty and admins can post department notices" }, { status: 403 });
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

  const msg = await prisma.departmentMessage.create({
    data: {
      departmentId,
      userId: user.id,
      body: parsed.data.body.trim(),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  return NextResponse.json({
    message: {
      id: msg.id,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
      sender: msg.user,
    },
  });
}
