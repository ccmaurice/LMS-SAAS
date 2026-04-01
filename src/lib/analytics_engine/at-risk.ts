export type AtRiskInput = {
  avgPercent: number | null;
  missedAssessments: number;
  /** 0–1 attendance proxy */
  attendanceRatio: number | null;
};

/** Lightweight heuristic 0–100 (higher = more at risk). Pure function for batch jobs / dashboards. */
export function scoreAtRisk(input: AtRiskInput): number {
  let score = 0;
  if (input.avgPercent != null && input.avgPercent < 60) score += 40;
  if (input.avgPercent != null && input.avgPercent < 50) score += 20;
  score += Math.min(30, input.missedAssessments * 6);
  if (input.attendanceRatio != null && input.attendanceRatio < 0.75) score += 20;
  return Math.min(100, Math.round(score));
}
