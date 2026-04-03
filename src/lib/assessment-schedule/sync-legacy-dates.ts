import type { AssessmentScheduleKind } from "@/generated/prisma/enums";

export type ScheduleEntryLike = {
  kind: AssessmentScheduleKind;
  startsAt: Date;
  endsAt: Date | null;
  sortOrder?: number;
};

/**
 * Derive legacy `availableFrom` / `dueAt` on Assessment from schedule rows (for APIs and gradual migration).
 * First CA_OPENS → availableFrom; first CA_DUE → dueAt; EXAM_WINDOW maps start→availableFrom, end→dueAt when missing.
 */
export function legacyDatesFromScheduleEntries(entries: ScheduleEntryLike[]): {
  availableFrom: Date | null;
  dueAt: Date | null;
} {
  if (entries.length === 0) {
    return { availableFrom: null, dueAt: null };
  }
  const sorted = [...entries].sort((a, b) => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return a.startsAt.getTime() - b.startsAt.getTime();
  });

  let availableFrom: Date | null = null;
  let dueAt: Date | null = null;

  for (const e of sorted) {
    if (e.kind === "CA_OPENS" && !availableFrom) {
      availableFrom = e.startsAt;
    }
    if (e.kind === "CA_DUE" && !dueAt) {
      dueAt = e.startsAt;
    }
    if (e.kind === "EXAM_WINDOW") {
      if (!availableFrom) availableFrom = e.startsAt;
      if (e.endsAt) {
        if (!dueAt) dueAt = e.endsAt;
      } else if (!dueAt) {
        dueAt = e.startsAt;
      }
    }
  }

  return { availableFrom, dueAt };
}
