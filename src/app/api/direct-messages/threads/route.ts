import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { otherParticipantId } from "@/lib/direct-messages/thread-order";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const threads = await prisma.directMessageThread.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [{ participantLowId: user.id }, { participantHighId: user.id }],
    },
    orderBy: { lastMessageAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, senderId: true },
      },
      participantLow: { select: { id: true, name: true, email: true, role: true, image: true } },
      participantHigh: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  const payload = threads.map((t) => {
    const otherId = otherParticipantId(t, user.id);
    const other = otherId === t.participantLowId ? t.participantLow : t.participantHigh;
    const last = t.messages[0];
    const raw = last?.body.replace(/\s+/g, " ").trim() ?? "";
    const preview = raw.slice(0, 120);
    return {
      threadId: t.id,
      other: {
        id: other.id,
        name: other.name,
        email: other.email,
        role: other.role,
        image: other.image,
      },
      lastPreview: raw.length >= 120 ? `${preview}…` : preview,
      lastAt: (last?.createdAt ?? t.lastMessageAt).toISOString(),
      lastFromMe: last?.senderId === user.id,
    };
  });

  return NextResponse.json({ threads: payload });
}
