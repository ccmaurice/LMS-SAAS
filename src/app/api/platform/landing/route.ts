import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";
import {
  DEFAULT_LANDING,
  LANDING_KEY,
  parseLandingFeatures,
  resolvePlatformLogoSrc,
} from "@/lib/platform/landing-defaults";
import { getRawLandingRowMap } from "@/lib/platform/landing-settings";
import { isSafePlatformLogoStoredValue } from "@/lib/platform/logo-storage";
import { removeUpload } from "@/lib/uploads/storage";

const featureSchema = z.object({
  title: z.string().max(120),
  body: z.string().max(800),
  span: z.string().max(80),
});

const patchSchema = z
  .object({
    kicker: z.string().max(120).optional(),
    headline: z.string().max(300).optional(),
    subheadline: z.string().max(600).optional(),
    features: z.array(featureSchema).min(1).max(8).optional(),
    clearLogo: z.boolean().optional(),
  })
  .refine((d) => d.kicker !== undefined || d.headline !== undefined || d.subheadline !== undefined || d.features !== undefined || d.clearLogo === true, {
    message: "No changes",
  });

export async function GET() {
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

  const raw = await getRawLandingRowMap();
  const logoRaw = raw[LANDING_KEY.logo]?.trim() || "";
  return NextResponse.json({
    kicker: raw[LANDING_KEY.kicker]?.trim() ?? "",
    headline: raw[LANDING_KEY.headline]?.trim() ?? "",
    subheadline: raw[LANDING_KEY.subheadline]?.trim() ?? "",
    features: parseLandingFeatures(raw[LANDING_KEY.features]),
    logoRaw,
    logoPreviewUrl: resolvePlatformLogoSrc(logoRaw || null),
    defaults: DEFAULT_LANDING,
  });
}

export async function PATCH(req: Request) {
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

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

  if (parsed.data.clearLogo) {
    const row = await prisma.platformSetting.findUnique({
      where: { key: LANDING_KEY.logo },
      select: { value: true },
    });
    if (row?.value && isSafePlatformLogoStoredValue(row.value)) {
      await removeUpload(row.value);
    }
    await prisma.platformSetting.upsert({
      where: { key: LANDING_KEY.logo },
      create: { key: LANDING_KEY.logo, value: "" },
      update: { value: "" },
    });
  }

  const upserts: { key: string; value: string }[] = [];
  if (parsed.data.kicker !== undefined) {
    upserts.push({ key: LANDING_KEY.kicker, value: parsed.data.kicker });
  }
  if (parsed.data.headline !== undefined) {
    upserts.push({ key: LANDING_KEY.headline, value: parsed.data.headline });
  }
  if (parsed.data.subheadline !== undefined) {
    upserts.push({ key: LANDING_KEY.subheadline, value: parsed.data.subheadline });
  }
  if (parsed.data.features !== undefined) {
    upserts.push({ key: LANDING_KEY.features, value: JSON.stringify(parsed.data.features) });
  }

  for (const u of upserts) {
    await prisma.platformSetting.upsert({
      where: { key: u.key },
      create: { key: u.key, value: u.value },
      update: { value: u.value },
    });
  }

  return NextResponse.json({ ok: true });
}
