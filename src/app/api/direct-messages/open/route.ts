import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canOpenDirectThread } from "@/lib/direct-messages/policy";
import { orderedParticipantIds } from "@/lib/direct-messages/thread-order";

const bodySchema = z.object({
  recipientId: z.string().min(1),
});

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const recipient = await prisma.user.findFirst({
    where: { id: parsed.data.recipientId, organizationId: user.organizationId },
    select: { id: true, role: true, organizationId: true },
  });

  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  const sender = { id: user.id, role: user.role, organizationId: user.organizationId };
  const ok = await canOpenDirectThread(sender, recipient);
  if (!ok) {
    return NextResponse.json({ error: "You cannot message this user" }, { status: 403 });
  }

  const [low, high] = orderedParticipantIds(user.id, recipient.id);

  const thread = await prisma.directMessageThread.upsert({
    where: {
      organizationId_participantLowId_participantHighId: {
        organizationId: user.organizationId,
        participantLowId: low,
        participantHighId: high,
      },
    },
    create: {
      organizationId: user.organizationId,
      participantLowId: low,
      participantHighId: high,
    },
    update: {},
  });

  return NextResponse.json({ threadId: thread.id });
}
