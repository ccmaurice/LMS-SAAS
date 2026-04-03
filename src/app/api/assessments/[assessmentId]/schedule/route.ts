import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse } from "@/lib/courses/access";
import { legacyDatesFromScheduleEntries } from "@/lib/assessment-schedule/sync-legacy-dates";

const KINDS = ["CA_OPENS", "CA_DUE", "EXAM_WINDOW"] as const;

const rowSchema = z.object({
  kind: z.enum(KINDS),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  label: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const putSchema = z.object({
  entries: z.array(rowSchema).max(64),
});

function normalizeRow(
  r: z.infer<typeof rowSchema>,
): {
  kind: (typeof KINDS)[number];
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  label: string | null;
  sortOrder: number;
} {
  const allDay = r.allDay ?? false;
  let startsAt = new Date(r.startsAt);
  let endsAt = r.endsAt != null ? new Date(r.endsAt) : null;
  if (allDay) {
    const s = new Date(startsAt);
    startsAt = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0));
    if (endsAt) {
      const e = new Date(endsAt);
      endsAt = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59, 999));
    } else if (r.kind === "EXAM_WINDOW") {
      endsAt = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 23, 59, 59, 999));
    }
  }
  if (r.kind === "EXAM_WINDOW" && !endsAt) {
    endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  }
  return {
    kind: r.kind,
    startsAt,
    endsAt,
    allDay,
    label: r.label === undefined || r.label === null ? null : r.label.trim() || null,
    sortOrder: r.sortOrder ?? 0,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canTeacherManageCourse(user, existing.course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.assessmentScheduleEntry.findMany({
    where: { assessmentId },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
  });

  return NextResponse.json({
    entries: rows.map((e) => ({
      id: e.id,
      kind: e.kind,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      allDay: e.allDay,
      label: e.label,
      sortOrder: e.sortOrder,
    })),
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canTeacherManageCourse(user, existing.course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const normalized = parsed.data.entries.map((r, i) => {
    const n = normalizeRow(r);
    return { ...n, sortOrder: r.sortOrder ?? i };
  });

  for (const r of normalized) {
    if (r.kind === "EXAM_WINDOW" && (!r.endsAt || r.endsAt.getTime() < r.startsAt.getTime())) {
      return NextResponse.json(
        { error: "EXAM_WINDOW rows need an end time after the start." },
        { status: 400 },
      );
    }
  }

  const legacy = legacyDatesFromScheduleEntries(
    normalized.map((r) => ({
      kind: r.kind,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      sortOrder: r.sortOrder,
    })),
  );

  await prisma.$transaction(async (tx) => {
    await tx.assessmentScheduleEntry.deleteMany({ where: { assessmentId } });
    if (normalized.length > 0) {
      await tx.assessmentScheduleEntry.createMany({
        data: normalized.map((r) => ({
          assessmentId,
          kind: r.kind,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
          allDay: r.allDay,
          label: r.label,
          sortOrder: r.sortOrder,
        })),
      });
    }
    await tx.assessment.update({
      where: { id: assessmentId },
      data: {
        availableFrom: legacy.availableFrom,
        dueAt: legacy.dueAt,
      },
    });
  });

  const rows = await prisma.assessmentScheduleEntry.findMany({
    where: { assessmentId },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    entries: rows.map((e) => ({
      id: e.id,
      kind: e.kind,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      allDay: e.allDay,
      label: e.label,
      sortOrder: e.sortOrder,
    })),
  });
}
