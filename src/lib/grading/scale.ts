import type { GradingScaleType } from "@/generated/prisma/enums";
import type { OrganizationSettings } from "@/lib/education_context/schema";
import { formatGradeDisplay as formatGradeDisplayEngine } from "@/lib/grading_engine";

/** Percent 0–100 → display string for the org/course scale (letter bands from optional org settings). */
export function formatGradeDisplay(
  percent: number,
  scale: GradingScaleType,
  orgSettings?: OrganizationSettings,
): string {
  return formatGradeDisplayEngine(percent, scale, orgSettings);
}
