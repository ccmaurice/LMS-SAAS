import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

const postSchema = z.object({
  body: z.string().min(1).max(4000).trim(),
});

const TAKE = 200;

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const rows = await prisma.organizationMessage.findMany({
    where: { organizationId: user.organizationId },
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

  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

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
      organizationId: user.organizationId,
      senderKind: "MEMBER",
      userId: user.id,
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
