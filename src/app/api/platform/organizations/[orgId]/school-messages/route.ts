import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";

const postSchema = z.object({
  body: z.string().min(1).max(4000).trim(),
});

const TAKE = 200;

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const rows = await prisma.organizationMessage.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: TAKE,
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  const messages = rows.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderKind: m.senderKind,
    platformEmail: m.platformEmail,
    user: m.user
      ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.user.role,
          image: m.user.image,
        }
      : null,
  }));

  return NextResponse.json({ messages, organization: { id: org.id, name: org.name, slug: org.slug } });
}

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const message = await prisma.organizationMessage.create({
    data: {
      organizationId: orgId,
      senderKind: "PLATFORM",
      platformEmail: op.email,
      body: parsed.data.body,
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  return NextResponse.json({
    message: {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      senderKind: message.senderKind,
      platformEmail: message.platformEmail,
      user: message.user,
    },
  });
}
