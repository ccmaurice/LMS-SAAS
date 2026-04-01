import type { EducationLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { parseOrganizationSettings, type OrganizationSettings } from "@/lib/education_context/schema";
import { resolveTerminology } from "@/lib/education_context/terminology";
import { STANDARD_4_POINT_GPA_BANDS } from "@/lib/grading_engine/letter-gpa";

export type EducationContext = {
  organizationId: string;
  educationLevel: EducationLevel;
  settings: OrganizationSettings;
  terminology: Record<string, string>;
};

export async function getEducationContext(organizationId: string): Promise<EducationContext | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, educationLevel: true, organizationSettings: true },
  });
  if (!org) return null;
  const parsed = parseOrganizationSettings(org.organizationSettings);
  const settings: OrganizationSettings =
    org.educationLevel === "HIGHER_ED" && (!parsed.gpaBands || parsed.gpaBands.length === 0)
      ? { ...parsed, gpaBands: STANDARD_4_POINT_GPA_BANDS }
      : parsed;
  return {
    organizationId: org.id,
    educationLevel: org.educationLevel,
    settings,
    terminology: resolveTerminology(org.educationLevel, settings),
  };
}
