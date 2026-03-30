import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";

export async function GET(req: Request) {
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 30));

  const [notifications, unreadCount] = await Promise.all([
    prisma.platformNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, type: true, title: true, body: true, link: true, read: true, createdAt: true },
    }),
    prisma.platformNotification.count({ where: { read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

const patchSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAllRead: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

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

  if (parsed.data.markAllRead) {
    await prisma.platformNotification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  const ids = parsed.data.notificationIds;
  if (!ids?.length) {
    return NextResponse.json({ error: "notificationIds or markAllRead required" }, { status: 400 });
  }

  await prisma.platformNotification.updateMany({
    where: { id: { in: ids } },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
