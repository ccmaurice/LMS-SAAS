export {
  organizationSettingsSchema,
  organizationEducationPatchSchema,
  parseOrganizationSettings,
  mergeOrganizationSettings,
  letterBandSchema,
  gpaBandSchema,
  type OrganizationSettings,
  type OrganizationEducationPatch,
} from "@/lib/education_context/schema";
export { defaultTerminologyForLevel, DEFAULT_TERMINOLOGY } from "@/lib/education_context/defaults";
export { resolveTerminology, term } from "@/lib/education_context/terminology";
export { getEducationContext, type EducationContext } from "@/lib/education_context/resolver";
export { academicCalendarCopy, type AcademicCalendarCopy } from "@/lib/education_context/academic-period-labels";
