import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

const postSchema = z.object({
  body: z.string().min(1).max(4000).trim(),
});

const TAKE = 200;

async function getThreadForMember(threadId: string, userId: string, organizationId: string) {
  return prisma.directMessageThread.findFirst({
    where: {
      id: threadId,
      organizationId,
      OR: [{ participantLowId: userId }, { participantHighId: userId }],
    },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const thread = await getThreadForMember(threadId, user.id, user.organizationId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.directMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: TAKE,
    include: {
      sender: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  const messages = rows.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    sender: {
      id: m.sender.id,
      name: m.sender.name,
      email: m.sender.email,
      role: m.sender.role,
      image: m.sender.image,
    },
  }));

  return NextResponse.json({ messages });
}

export async function POST(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const thread = await getThreadForMember(threadId, user.id, user.organizationId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.directMessage.create({
      data: {
        threadId,
        senderId: user.id,
        body: parsed.data.body,
      },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true, image: true } },
      },
    });
    await tx.directMessageThread.update({
      where: { id: threadId },
      data: { lastMessageAt: m.createdAt },
    });
    return m;
  });

  return NextResponse.json({
    message: {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        email: message.sender.email,
        role: message.sender.role,
        image: message.sender.image,
      },
    },
  });
}
