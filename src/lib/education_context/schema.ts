import { z } from "zod";

/** Single letter band: percent must be >= minPercent (inclusive) to earn this letter; first matching band wins (sort descending). */
export const letterBandSchema = z.object({
  minPercent: z.number().min(0).max(100),
  letter: z.string().min(1).max(8),
});

export const gpaBandSchema = z.object({
  minPercent: z.number().min(0).max(100),
  gpa: z.number().min(0).max(5),
});

export const organizationSettingsSchema = z
  .object({
    terminology: z.record(z.string(), z.string()).optional(),
    letterBands: z.array(letterBandSchema).max(32).optional(),
    gpaBands: z.array(gpaBandSchema).max(32).optional(),
    reportShowRank: z.boolean().optional(),
    features: z.record(z.string(), z.boolean()).optional(),
    gradingProfileId: z.string().max(128).optional(),
  })
  .strict();

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

const educationLevelEnum = z.enum(["PRIMARY", "SECONDARY", "HIGHER_ED"]);

export const organizationEducationPatchSchema = z.object({
  educationLevel: educationLevelEnum.optional(),
  organizationSettings: organizationSettingsSchema.partial().optional(),
});

export type OrganizationEducationPatch = z.infer<typeof organizationEducationPatchSchema>;

export function parseOrganizationSettings(raw: unknown): OrganizationSettings {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "object") return {};
  const p = organizationSettingsSchema.safeParse(raw);
  return p.success ? p.data : {};
}

export function mergeOrganizationSettings(
  current: unknown,
  patch: Partial<OrganizationSettings>,
): OrganizationSettings {
  const base = parseOrganizationSettings(current);
  const next = { ...base };
  if (patch.terminology !== undefined) {
    next.terminology = { ...base.terminology, ...patch.terminology };
  }
  if (patch.letterBands !== undefined) next.letterBands = patch.letterBands;
  if (patch.gpaBands !== undefined) next.gpaBands = patch.gpaBands;
  if (patch.reportShowRank !== undefined) next.reportShowRank = patch.reportShowRank;
  if (patch.features !== undefined) {
    next.features = { ...base.features, ...patch.features };
  }
  if (patch.gradingProfileId !== undefined) next.gradingProfileId = patch.gradingProfileId;
  return parseOrganizationSettings(next);
}
