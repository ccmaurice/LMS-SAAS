import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const KINDS = ["RESUMPTION", "CLOSURE", "HOLIDAY", "EVENT", "ACTIVITY", "OTHER"] as const;

const patchSchema = z.object({
  kind: z.enum(KINDS).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional().nullable(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
});

function normalizeAllDay(
  allDay: boolean,
  startsAt: Date,
  endsAt: Date | null,
): { startsAt: Date; endsAt: Date | null } {
  if (!allDay) return { startsAt, endsAt };
  const s = new Date(startsAt);
  const start = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0));
  let end: Date | null = null;
  if (endsAt) {
    const e = new Date(endsAt);
    end = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59, 999));
  } else {
    end = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 23, 59, 59, 999));
  }
  return { startsAt: start, endsAt: end };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const existing = await prisma.schoolCalendarEvent.findFirst({
    where: { id: eventId, organizationId: user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const nextAllDay = parsed.data.allDay ?? existing.allDay;
  const nextStarts = parsed.data.startsAt != null ? new Date(parsed.data.startsAt) : existing.startsAt;
  const nextEnds =
    parsed.data.endsAt !== undefined
      ? parsed.data.endsAt
        ? new Date(parsed.data.endsAt)
        : null
      : existing.endsAt;

  const datesTouched =
    parsed.data.startsAt != null || parsed.data.endsAt !== undefined || parsed.data.allDay !== undefined;
  let startsAt = nextStarts;
  let endsAt = nextEnds;
  if (datesTouched) {
    ({ startsAt, endsAt } = normalizeAllDay(nextAllDay, nextStarts, nextEnds));
  }

  const updated = await prisma.schoolCalendarEvent.update({
    where: { id: eventId },
    data: {
      ...(parsed.data.kind !== undefined && { kind: parsed.data.kind }),
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description === null ? null : parsed.data.description.trim() || null,
      }),
      ...(datesTouched ? { startsAt, endsAt, allDay: nextAllDay } : {}),
    },
  });

  return NextResponse.json({ event: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const existing = await prisma.schoolCalendarEvent.findFirst({
    where: { id: eventId, organizationId: user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.schoolCalendarEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
