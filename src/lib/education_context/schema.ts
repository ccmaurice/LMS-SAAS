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
    /** Printed completion certificate — signatory (optional image + printed name/title). */
    certificateSignerName: z.string().max(120).optional(),
    certificateSignerTitle: z.string().max(200).optional(),
    certificateSignatureImageUrl: z.string().max(2000).optional(),
    /** Sentence between recipient name and course title, e.g. "has successfully completed the course". */
    certificateCompletionPhrase: z.string().max(280).optional(),
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
  if (patch.certificateSignerName !== undefined) {
    const t = patch.certificateSignerName.trim();
    if (t) next.certificateSignerName = t;
    else delete next.certificateSignerName;
  }
  if (patch.certificateSignerTitle !== undefined) {
    const t = patch.certificateSignerTitle.trim();
    if (t) next.certificateSignerTitle = t;
    else delete next.certificateSignerTitle;
  }
  if (patch.certificateSignatureImageUrl !== undefined) {
    const t = patch.certificateSignatureImageUrl.trim();
    if (t) next.certificateSignatureImageUrl = t;
    else delete next.certificateSignatureImageUrl;
  }
  if (patch.certificateCompletionPhrase !== undefined) {
    const t = patch.certificateCompletionPhrase.trim();
    if (t) next.certificateCompletionPhrase = t;
    else delete next.certificateCompletionPhrase;
  }
  return parseOrganizationSettings(next);
}
