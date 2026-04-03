import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const KINDS = ["RESUMPTION", "CLOSURE", "HOLIDAY", "EVENT", "ACTIVITY", "OTHER"] as const;

const createSchema = z.object({
  kind: z.enum(KINDS),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional().nullable(),
  startsAt: z.string().datetime(),
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

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const events = await prisma.schoolCalendarEvent.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const allDay = parsed.data.allDay ?? false;
  let startsAt = new Date(parsed.data.startsAt);
  let endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  ({ startsAt, endsAt } = normalizeAllDay(allDay, startsAt, endsAt));

  const row = await prisma.schoolCalendarEvent.create({
    data: {
      organizationId: user.organizationId,
      kind: parsed.data.kind,
      title: parsed.data.title.trim(),
      description:
        parsed.data.description === undefined || parsed.data.description === null
          ? null
          : parsed.data.description.trim() || null,
      startsAt,
      endsAt,
      allDay,
      createdById: user.id,
    },
  });

  return NextResponse.json({ event: row });
}
