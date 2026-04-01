import { prisma } from "@/lib/db";
import {
  DEFAULT_LANDING,
  LANDING_KEY,
  type PublicLandingPayload,
  parseLandingFeatures,
  resolvePlatformLogoSrc,
} from "@/lib/platform/landing-defaults";
import { isPrismaPublicFallbackError } from "@/lib/prisma-errors";

export type { LandingFeature, PublicLandingPayload } from "@/lib/platform/landing-defaults";
export {
  DEFAULT_LANDING,
  DEFAULT_LANDING_FEATURES,
  LANDING_KEY,
  parseLandingFeatures,
  resolvePlatformLogoSrc,
} from "@/lib/platform/landing-defaults";

function defaultLandingPayload(): PublicLandingPayload {
  return {
    logoSrc: null,
    kicker: DEFAULT_LANDING.kicker,
    headline: DEFAULT_LANDING.headline,
    subheadline: DEFAULT_LANDING.subheadline,
    features: DEFAULT_LANDING.features,
  };
}

export async function getPublicLandingPayload(): Promise<PublicLandingPayload> {
  try {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { startsWith: "landing." } },
      select: { key: true, value: true },
    });
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
    const logoRaw = m[LANDING_KEY.logo]?.trim() || null;
    return {
      logoSrc: resolvePlatformLogoSrc(logoRaw),
      kicker: m[LANDING_KEY.kicker]?.trim() || DEFAULT_LANDING.kicker,
      headline: m[LANDING_KEY.headline]?.trim() || DEFAULT_LANDING.headline,
      subheadline: m[LANDING_KEY.subheadline]?.trim() || DEFAULT_LANDING.subheadline,
      features: parseLandingFeatures(m[LANDING_KEY.features]),
    };
  } catch (e) {
    if (isPrismaPublicFallbackError(e)) {
      return defaultLandingPayload();
    }
    throw e;
  }
}

export async function getRawLandingRowMap(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { startsWith: "landing." } },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (e) {
    if (isPrismaPublicFallbackError(e)) return {};
    throw e;
  }
}
