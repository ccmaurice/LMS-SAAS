import type { EducationLevel } from "@/generated/prisma/enums";
import { defaultTerminologyForLevel } from "@/lib/education_context/defaults";
import type { OrganizationSettings } from "@/lib/education_context/schema";

export function resolveTerminology(level: EducationLevel, settings: OrganizationSettings): Record<string, string> {
  const defaults = defaultTerminologyForLevel(level);
  return { ...defaults, ...(settings.terminology ?? {}) };
}

export function term(
  map: Record<string, string>,
  key: string,
  fallback: string = key,
): string {
  return map[key] ?? fallback;
}
