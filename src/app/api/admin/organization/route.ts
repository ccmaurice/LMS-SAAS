import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { isValidHex6 } from "@/lib/org-branding";
import {
  isSafeOrgHeroSettingKey,
  isSafeOrgHeroSettingStoredValue,
  isSafeOrgLogoSettingKey,
  isSafeOrgLogoSettingStoredValue,
} from "@/lib/org/public-assets";
import { removeUpload } from "@/lib/uploads/storage";
import {
  mergeOrganizationSettings,
  organizationSettingsSchema,
} from "@/lib/education_context";

const THEME_ENUM = ["DEFAULT", "SLATE", "VIOLET", "EMERALD", "ROSE", "AMBER"] as const;

const EDUCATION_LEVEL = ["PRIMARY", "SECONDARY", "HIGHER_ED"] as const;

const patchSchema = z.object({
  reportCardsPublished: z.boolean().optional(),
  certificatesPublished: z.boolean().optional(),
  academicYearLabel: z.string().min(4).max(64).optional(),
  promotionPassMinPercent: z.number().min(0).max(100).optional(),
  promotionProbationMinPercent: z.number().min(0).max(100).optional(),
  themeTemplate: z.enum(THEME_ENUM).optional(),
  customPrimaryHex: z.union([z.string(), z.literal(""), z.null()]).optional(),
  customAccentHex: z.union([z.string(), z.literal(""), z.null()]).optional(),
  heroImageUrl: z.union([z.literal(""), z.null(), z.string().max(2000)]).optional(),
  logoImageUrl: z.union([z.literal(""), z.null(), z.string().max(2000)]).optional(),
  educationLevel: z.enum(EDUCATION_LEVEL).optional(),
  organizationSettings: organizationSettingsSchema.partial().optional(),
});

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const orgId = user.organizationId;

  if (parsed.data.reportCardsPublished !== undefined) {
    data.reportCardsPublished = parsed.data.reportCardsPublished;
  }
  if (parsed.data.certificatesPublished !== undefined) {
    data.certificatesPublished = parsed.data.certificatesPublished;
  }
  if (parsed.data.academicYearLabel !== undefined) {
    data.academicYearLabel = parsed.data.academicYearLabel.trim();
  }
  if (parsed.data.promotionPassMinPercent !== undefined) {
    data.promotionPassMinPercent = parsed.data.promotionPassMinPercent;
  }
  if (parsed.data.promotionProbationMinPercent !== undefined) {
    data.promotionProbationMinPercent = parsed.data.promotionProbationMinPercent;
  }
  if (parsed.data.themeTemplate !== undefined) {
    data.themeTemplate = parsed.data.themeTemplate;
  }
  if (parsed.data.customPrimaryHex !== undefined) {
    const v = parsed.data.customPrimaryHex;
    if (v === "" || v === null) {
      data.customPrimaryHex = null;
    } else if (typeof v === "string" && isValidHex6(v)) {
      data.customPrimaryHex = v;
    } else {
      return NextResponse.json({ error: "customPrimaryHex must be #RRGGBB or empty" }, { status: 400 });
    }
  }
  if (parsed.data.customAccentHex !== undefined) {
    const v = parsed.data.customAccentHex;
    if (v === "" || v === null) {
      data.customAccentHex = null;
    } else if (typeof v === "string" && isValidHex6(v)) {
      data.customAccentHex = v;
    } else {
      return NextResponse.json({ error: "customAccentHex must be #RRGGBB or empty" }, { status: 400 });
    }
  }

  if (parsed.data.heroImageUrl !== undefined) {
    const v = parsed.data.heroImageUrl;
    const next: string | null = v === "" || v === null ? null : v.trim();
    if (
      next &&
      !/^https?:\/\//i.test(next) &&
      !isSafeOrgHeroSettingKey(next, orgId)
    ) {
      return NextResponse.json(
        { error: "Hero image must be an https URL, empty, or your uploaded school hero file" },
        { status: 400 },
      );
    }

    const current = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { heroImageUrl: true },
    });

    if (
      current?.heroImageUrl &&
      isSafeOrgHeroSettingStoredValue(current.heroImageUrl, orgId) &&
      current.heroImageUrl !== next
    ) {
      await removeUpload(current.heroImageUrl);
    }

    data.heroImageUrl = next;
  }

  if (parsed.data.logoImageUrl !== undefined) {
    const v = parsed.data.logoImageUrl;
    const next: string | null = v === "" || v === null ? null : v.trim();
    if (
      next &&
      !/^https?:\/\//i.test(next) &&
      !isSafeOrgLogoSettingKey(next, orgId)
    ) {
      return NextResponse.json(
        { error: "Brand logo must be an https URL, empty, or your uploaded logo file" },
        { status: 400 },
      );
    }

    const currentLogo = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { logoImageUrl: true },
    });

    if (
      currentLogo?.logoImageUrl &&
      isSafeOrgLogoSettingStoredValue(currentLogo.logoImageUrl, orgId) &&
      currentLogo.logoImageUrl !== next
    ) {
      await removeUpload(currentLogo.logoImageUrl);
    }

    data.logoImageUrl = next;
  }

  if (parsed.data.educationLevel !== undefined) {
    data.educationLevel = parsed.data.educationLevel;
  }

  if (parsed.data.organizationSettings !== undefined) {
    const current = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { organizationSettings: true },
    });
    data.organizationSettings = mergeOrganizationSettings(current?.organizationSettings, parsed.data.organizationSettings);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const pass = (data.promotionPassMinPercent as number | undefined) ?? undefined;
  const prob = (data.promotionProbationMinPercent as number | undefined) ?? undefined;
  if (pass !== undefined && prob !== undefined && prob > pass) {
    return NextResponse.json(
      { error: "promotionProbationMinPercent must be ≤ promotionPassMinPercent" },
      { status: 400 },
    );
  }

  const org = await prisma.organization.update({
    where: { id: orgId },
    data,
    select: {
      reportCardsPublished: true,
      certificatesPublished: true,
      academicYearLabel: true,
      promotionPassMinPercent: true,
      promotionProbationMinPercent: true,
      themeTemplate: true,
      customPrimaryHex: true,
      customAccentHex: true,
      heroImageUrl: true,
      logoImageUrl: true,
      educationLevel: true,
      organizationSettings: true,
    },
  });

  return NextResponse.json({ organization: org });
}
