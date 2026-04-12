import { isSafePlatformFaviconStoredValue } from "@/lib/platform/favicon-storage";
import { isSafePlatformLogoStoredValue } from "@/lib/platform/logo-storage";
import { isAllowedPlatformExternalMediaUrl } from "@/lib/uploads/blob-ref";

export const LANDING_KEY = {
  kicker: "landing.kicker",
  headline: "landing.headline",
  subheadline: "landing.subheadline",
  features: "landing.features",
  logo: "landing.logo",
  /** Browser tab icon site-wide (separate from marketing hero logo). */
  favicon: "landing.favicon",
} as const;

export type LandingFeature = { title: string; body: string; span: string };

export const DEFAULT_LANDING_FEATURES: LandingFeature[] = [
  { title: "Multi-tenant", body: "Each school at /o/your-slug with isolated data.", span: "md:col-span-2" },
  { title: "Roles", body: "Admin, teacher, and student flows with JWT sessions.", span: "md:col-span-1" },
  { title: "Assessments", body: "Quizzes, AI-assisted grading, and progress.", span: "md:col-span-1" },
  { title: "Library & blog", body: "Resources, headless CMS copy, and course chat.", span: "md:col-span-2" },
];

export const DEFAULT_LANDING = {
  kicker: "SaaS LMS",
  headline: "Learning that feels as good as it runs",
  subheadline:
    "JWT auth, org URLs, assessments, resource library, and a polished dashboard — seed the demo and explore.",
  features: DEFAULT_LANDING_FEATURES,
};

export function parseLandingFeatures(raw: string | undefined | null): LandingFeature[] {
  if (!raw?.trim()) return DEFAULT_LANDING.features;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return DEFAULT_LANDING.features;
    const out: LandingFeature[] = [];
    for (const item of j) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.slice(0, 120) : "";
      const body = typeof o.body === "string" ? o.body.slice(0, 800) : "";
      const span = typeof o.span === "string" ? o.span.slice(0, 80) : "md:col-span-1";
      if (title || body) out.push({ title, body, span });
    }
    return out.length > 0 ? out : DEFAULT_LANDING.features;
  } catch {
    return DEFAULT_LANDING.features;
  }
}

export function resolvePlatformLogoSrc(logoValue: string | null | undefined): string | null {
  const v = logoValue?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return isAllowedPlatformExternalMediaUrl(v) ? v : null;
  if (isSafePlatformLogoStoredValue(v)) return "/api/public/platform/logo";
  return null;
}

export function resolvePlatformFaviconSrc(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return isAllowedPlatformExternalMediaUrl(v) ? v : null;
  if (isSafePlatformFaviconStoredValue(v)) return "/api/public/platform/favicon";
  return null;
}

export type PublicLandingPayload = {
  logoSrc: string | null;
  faviconSrc: string | null;
  kicker: string;
  headline: string;
  subheadline: string;
  features: LandingFeature[];
};
