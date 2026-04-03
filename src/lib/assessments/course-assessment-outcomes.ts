/**
 * Course-level rollups for staff “assessment outcomes” (Phase E).
 */

export type OutcomeSubmission = {
  totalScore: number | null;
  maxScore: number | null;
  userId: string;
};

export type OutcomesListFilters = {
  show: "all" | "published";
  kind: "all" | "QUIZ" | "EXAM";
  /** Phase G — limit to published rows that flag low mean or low reach. */
  attention: "all" | "flagged";
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function parseOutcomesListFilters(
  sp: Record<string, string | string[] | undefined>,
): OutcomesListFilters {
  const show = firstParam(sp.show) === "published" ? "published" : "all";
  const k = firstParam(sp.kind);
  const kind = k === "QUIZ" || k === "EXAM" ? k : "all";
  const attention = firstParam(sp.attention) === "flagged" ? "flagged" : "all";
  return { show, kind, attention };
}

export function outcomesListSearchParams(f: OutcomesListFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.show === "published") p.set("show", "published");
  if (f.kind !== "all") p.set("kind", f.kind);
  if (f.attention === "flagged") p.set("attention", "flagged");
  return p;
}

export function submissionScorePercents(subs: OutcomeSubmission[]): number[] {
  return subs
    .filter((s) => s.maxScore != null && s.maxScore > 0)
    .map((s) => ((s.totalScore ?? 0) / s.maxScore!) * 100);
}

function medianSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const m = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[m]!;
  return (sorted[m - 1]! + sorted[m]!) / 2;
}

export type ScoreSummary = {
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  attemptCount: number;
  /** Submissions with positive maxScore (used for % stats). */
  scoredAttemptCount: number;
  distinctStudents: number;
};

export function summarizeOutcomeSubmissions(subs: OutcomeSubmission[]): ScoreSummary {
  const percents = submissionScorePercents(subs);
  const sorted = [...percents].sort((a, b) => a - b);
  const mean = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : null;
  return {
    mean,
    median: medianSorted(sorted),
    min: sorted.length ? sorted[0]! : null,
    max: sorted.length ? sorted[sorted.length - 1]! : null,
    attemptCount: subs.length,
    scoredAttemptCount: percents.length,
    distinctStudents: new Set(subs.map((s) => s.userId)).size,
  };
}

export function meanSubmittedScorePercent(subs: OutcomeSubmission[]): number | null {
  return summarizeOutcomeSubmissions(subs).mean;
}

/** Participation: distinct submitters / enrolled students (0–100), or null if no enrollment row. */
export function submitParticipationPercent(distinctSubmitters: number, enrolledCount: number): number | null {
  if (enrolledCount <= 0) return null;
  return Math.min(100, (distinctSubmitters / enrolledCount) * 100);
}
