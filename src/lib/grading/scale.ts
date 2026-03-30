import type { GradingScaleType } from "@/generated/prisma/enums";

/** Percent 0–100 → display string for the org/course scale. */
export function formatGradeDisplay(percent: number, scale: GradingScaleType): string {
  const p = Math.min(100, Math.max(0, percent));
  if (scale === "PERCENTAGE") {
    return `${Math.round(p)}%`;
  }
  if (scale === "NUMERIC_10") {
    return (p / 10).toFixed(1);
  }
  return letterFromPercent(p);
}

function letterFromPercent(p: number): string {
  if (p >= 93) return "A";
  if (p >= 90) return "A-";
  if (p >= 87) return "B+";
  if (p >= 83) return "B";
  if (p >= 80) return "B-";
  if (p >= 77) return "C+";
  if (p >= 73) return "C";
  if (p >= 70) return "C-";
  if (p >= 67) return "D+";
  if (p >= 63) return "D";
  if (p >= 60) return "D-";
  return "F";
}
