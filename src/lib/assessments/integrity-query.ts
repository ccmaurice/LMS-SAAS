import type { Prisma } from "@/generated/prisma/client";

/** Pagination size for integrity log UI and API export caps (keep in sync with filters UI). */
export const INTEGRITY_PAGE_SIZE = 50;

/** Safe display of JSONB payloads (avoids render crash on BigInt / circular refs). */
export function formatIntegrityPayloadForDisplay(payload: unknown): string {
  if (payload == null) return "—";
  try {
    return JSON.stringify(payload, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
  } catch {
    return "[payload]";
  }
}

/** Event types emitted by `AssessmentProctorHooks` (extend as new types are logged). */
export const INTEGRITY_EVENT_TYPES = ["window_blur", "document_hidden", "fullscreen_exit"] as const;

export type IntegrityEventTypeFilter = (typeof INTEGRITY_EVENT_TYPES)[number] | "";

export type IntegrityListFilters = {
  student: string;
  eventType: string;
  /** YYYY-MM-DD in UTC interpretation for `from` start of day */
  fromDate: string;
  /** YYYY-MM-DD inclusive end of day UTC */
  toDate: string;
  page: number;
};

const DEFAULT_PAGE = 1;

function firstParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

export function parseIntegrityListFilters(
  sp: Record<string, string | string[] | undefined>,
): IntegrityListFilters {
  const pageRaw = Number.parseInt(firstParam(sp.page), 10);
  return {
    student: firstParam(sp.student).trim(),
    eventType: firstParam(sp.eventType).trim(),
    fromDate: firstParam(sp.from).trim(),
    toDate: firstParam(sp.to).trim(),
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : DEFAULT_PAGE,
  };
}

export function buildProctoringWhere(
  assessmentId: string,
  f: Pick<IntegrityListFilters, "student" | "eventType" | "fromDate" | "toDate">,
): Prisma.ProctoringEventWhereInput {
  const and: Prisma.ProctoringEventWhereInput[] = [{ assessmentId }];

  if (f.eventType && INTEGRITY_EVENT_TYPES.includes(f.eventType as (typeof INTEGRITY_EVENT_TYPES)[number])) {
    and.push({ eventType: f.eventType });
  }

  if (f.fromDate) {
    const d = new Date(`${f.fromDate}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) {
      and.push({ createdAt: { gte: d } });
    }
  }

  if (f.toDate) {
    const d = new Date(`${f.toDate}T23:59:59.999Z`);
    if (!Number.isNaN(d.getTime())) {
      and.push({ createdAt: { lte: d } });
    }
  }

  if (f.student) {
    and.push({
      user: {
        OR: [
          { email: { contains: f.student, mode: "insensitive" } },
          { name: { contains: f.student, mode: "insensitive" } },
        ],
      },
    });
  }

  return { AND: and };
}

export function integrityExportSearchParams(
  f: Pick<IntegrityListFilters, "student" | "eventType" | "fromDate" | "toDate">,
): URLSearchParams {
  const p = new URLSearchParams();
  if (f.student) p.set("student", f.student);
  if (f.eventType && INTEGRITY_EVENT_TYPES.includes(f.eventType as (typeof INTEGRITY_EVENT_TYPES)[number])) {
    p.set("eventType", f.eventType);
  }
  if (f.fromDate) p.set("from", f.fromDate);
  if (f.toDate) p.set("to", f.toDate);
  return p;
}

/** Query string for the integrity UI list (includes pagination). */
export function integrityListSearchParams(f: IntegrityListFilters): URLSearchParams {
  const p = integrityExportSearchParams(f);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}
