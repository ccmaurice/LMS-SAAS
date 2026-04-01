import type { EducationLevel } from "@/generated/prisma/enums";
import type { GradingScaleType } from "@/generated/prisma/enums";
import type { OrganizationSettings } from "@/lib/education_context/schema";

/** Default A–F cutoffs (legacy `scale.ts` behavior). */
/** Standard 4.0 scale aligned with DEFAULT_LETTER_BANDS cutoffs (higher-ed default when org omits gpaBands). */
export const STANDARD_4_POINT_GPA_BANDS: { minPercent: number; gpa: number }[] = [
  { minPercent: 93, gpa: 4.0 },
  { minPercent: 90, gpa: 3.7 },
  { minPercent: 87, gpa: 3.3 },
  { minPercent: 83, gpa: 3.0 },
  { minPercent: 80, gpa: 2.7 },
  { minPercent: 77, gpa: 2.3 },
  { minPercent: 73, gpa: 2.0 },
  { minPercent: 70, gpa: 1.7 },
  { minPercent: 67, gpa: 1.3 },
  { minPercent: 63, gpa: 1.0 },
  { minPercent: 60, gpa: 0.7 },
  { minPercent: 0, gpa: 0 },
];

export const DEFAULT_LETTER_BANDS: { minPercent: number; letter: string }[] = [
  { minPercent: 93, letter: "A" },
  { minPercent: 90, letter: "A-" },
  { minPercent: 87, letter: "B+" },
  { minPercent: 83, letter: "B" },
  { minPercent: 80, letter: "B-" },
  { minPercent: 77, letter: "C+" },
  { minPercent: 73, letter: "C" },
  { minPercent: 70, letter: "C-" },
  { minPercent: 67, letter: "D+" },
  { minPercent: 63, letter: "D" },
  { minPercent: 60, letter: "D-" },
  { minPercent: 0, letter: "F" },
];

function sortedBands(settings: OrganizationSettings) {
  const bands = settings.letterBands?.length ? settings.letterBands : DEFAULT_LETTER_BANDS;
  return [...bands].sort((a, b) => b.minPercent - a.minPercent);
}

/** Percent 0–100 → letter using org bands or defaults. */
export function letterFromPercent(percent: number, settings: OrganizationSettings = {}): string {
  const p = Math.min(100, Math.max(0, percent));
  for (const b of sortedBands(settings)) {
    if (p >= b.minPercent) return b.letter;
  }
  return "F";
}

/** GPA from percent when `gpaBands` configured (higher-ed); otherwise undefined. */
export function gpaFromPercent(percent: number, settings: OrganizationSettings): number | undefined {
  const bands = settings.gpaBands;
  if (!bands?.length) return undefined;
  const p = Math.min(100, Math.max(0, percent));
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  for (const b of sorted) {
    if (p >= b.minPercent) return b.gpa;
  }
  return sorted[sorted.length - 1]?.gpa;
}

export function formatGradeDisplay(
  percent: number,
  scale: GradingScaleType,
  settings: OrganizationSettings = {},
): string {
  const p = Math.min(100, Math.max(0, percent));
  if (scale === "PERCENTAGE") {
    return `${Math.round(p)}%`;
  }
  if (scale === "NUMERIC_10") {
    return (p / 10).toFixed(1);
  }
  return letterFromPercent(p, settings);
}

export function letterAndGpaForLevel(
  percent: number,
  educationLevel: EducationLevel,
  scale: GradingScaleType,
  settings: OrganizationSettings,
): { letter?: string; gpa?: number } {
  if (scale !== "LETTER_AF") {
    return {};
  }
  if (educationLevel === "PRIMARY") {
    return {};
  }
  const letter = letterFromPercent(percent, settings);
  const gpa =
    educationLevel === "HIGHER_ED" ? gpaFromPercent(percent, settings) : undefined;
  return { letter, gpa };
}
