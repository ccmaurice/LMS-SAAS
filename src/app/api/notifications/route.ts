import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 30));

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, body: true, link: true, read: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

const patchSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAllRead: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

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
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  const ids = parsed.data.notificationIds;
  if (!ids?.length) {
    return NextResponse.json({ error: "notificationIds or markAllRead required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
