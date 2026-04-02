import { youtubeEmbedSrc } from "@/lib/youtube";
import {
  isSafeOrgAboutVideoKey,
  isSafeOrgCmsHeroKey,
  isSafeOrgHeroSettingKey,
  isSafeOrgPublicCardImageStoredValue,
  isSafeOrgPublicCardVideoStoredValue,
} from "@/lib/org/public-assets";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";

export type SchoolPublicCmsField = {
  key: string;
  label: string;
  hint: string;
  rows: number;
  assetUpload?: "cmsHero" | "aboutVideo";
};

/** CMS keys for the public one-page school site (`/school/[slug]`). Admins edit values in CMS. */
export const SCHOOL_PUBLIC_CMS_KEYS: readonly SchoolPublicCmsField[] = [
  {
    key: "school.public.hero.title",
    label: "Hero title",
    hint: "Main headline on the public page.",
    rows: 2,
  },
  {
    key: "school.public.hero.subtitle",
    label: "Hero subtitle",
    hint: "Supporting line under the headline.",
    rows: 3,
  },
  {
    key: "school.public.hero.imageUrl",
    label: "Hero image (URL or upload)",
    hint: "Paste an https image link, or use Upload below. Overrides the default hero from School settings when set.",
    rows: 2,
    assetUpload: "cmsHero",
  },
  {
    key: "school.public.hero.ctaText",
    label: "Hero button label",
    hint: 'e.g. "Apply now" or "Member login"',
    rows: 1,
  },
  {
    key: "school.public.hero.ctaHref",
    label: "Hero button link",
    hint: "Full URL or path, e.g. /login?org=demo-school",
    rows: 2,
  },
  {
    key: "school.public.admissions",
    label: "Admissions",
    hint: "Overview for prospective families.",
    rows: 8,
  },
  {
    key: "school.public.about",
    label: "About us",
    hint: "Mission, history, leadership — plain text (paragraphs separated by blank lines).",
    rows: 8,
  },
  {
    key: "school.public.about.videoUrl",
    label: "About video (YouTube link or upload)",
    hint: "Paste a YouTube URL, a direct .mp4/.webm link, or upload MP4/WebM below.",
    rows: 2,
    assetUpload: "aboutVideo",
  },
  {
    key: "school.public.gallery",
    label: "Gallery images",
    hint: "One image URL per line (https).",
    rows: 6,
  },
  {
    key: "school.public.contact",
    label: "Contact",
    hint: "Address, phone, email, office hours — plain text.",
    rows: 8,
  },
];

export type SchoolPublicCmsMap = Record<string, string>;

export function parseGalleryUrls(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (Array.isArray(j)) {
      return j.filter((x): x is string => typeof x === "string" && /^https?:\/\//i.test(x.trim()));
    }
  } catch {
    /* use lines */
  }
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

/** Prefer new About key; fall back to legacy Enrollment CMS copy. */
export function aboutBodyFromCms(cms: SchoolPublicCmsMap): string {
  const next = cms["school.public.about"]?.trim() ?? "";
  if (next) return next;
  return cms["school.public.enrollment"]?.trim() ?? "";
}

export function resolveHeroImageSrc(args: {
  slug: string;
  orgId: string;
  orgHeroImageUrl: string | null;
  cmsHeroImageUrl: string | undefined;
}): string | null {
  const cms = args.cmsHeroImageUrl?.trim();
  if (cms) {
    if (/^https?:\/\//i.test(cms)) return cms;
    if (isSafeOrgCmsHeroKey(cms, args.orgId)) {
      return `/api/public/organizations/${args.slug}/cms-hero`;
    }
  }
  const org = args.orgHeroImageUrl?.trim();
  if (!org) return null;
  if (/^https?:\/\//i.test(org)) return org;
  if (isSafeOrgHeroSettingKey(org, args.orgId)) {
    return `/api/public/organizations/${args.slug}/hero`;
  }
  return null;
}

export type AboutVideoRender =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "video"; src: string };

export function resolveAboutVideoSource(args: {
  slug: string;
  orgId: string;
  raw: string | undefined | null;
}): AboutVideoRender | null {
  const v = args.raw?.trim() ?? "";
  if (!v) return null;

  const yt = youtubeEmbedSrc(v);
  if (yt) return { kind: "youtube", embedUrl: yt };

  if (/^https?:\/\//i.test(v) && /\.(mp4|webm)(\?[^#]*)?(#.*)?$/i.test(v)) {
    return { kind: "video", src: v };
  }

  if (isSafeOrgAboutVideoKey(v, args.orgId)) {
    return { kind: "video", src: `/api/public/organizations/${args.slug}/about-video` };
  }

  return null;
}

export const SCHOOL_PUBLIC_EXTRA_CARDS_KEY = "school.public.extraCards" as const;

export type SchoolPublicExtraCard = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  videoUrl: string;
};

/** Upper bound for custom sections on `/school/[slug]` (editor + parser). */
export const MAX_SCHOOL_PUBLIC_EXTRA_CARDS = 24;

export function parseSchoolPublicExtraCards(raw: string | undefined | null): SchoolPublicExtraCard[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: SchoolPublicExtraCard[] = [];
    for (const item of j) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 80) : "";
      const title = typeof o.title === "string" ? o.title.slice(0, 200) : "";
      if (!id || !title.trim()) continue;
      const body = typeof o.body === "string" ? o.body.slice(0, 12_000) : "";
      const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl.slice(0, 2000) : "";
      const videoUrl = typeof o.videoUrl === "string" ? o.videoUrl.slice(0, 2000) : "";
      out.push({ id, title: title.trim(), body, imageUrl: imageUrl.trim(), videoUrl: videoUrl.trim() });
      if (out.length >= MAX_SCHOOL_PUBLIC_EXTRA_CARDS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function resolvePublicCardImageSrc(args: {
  slug: string;
  orgId: string;
  raw: string | undefined | null;
}): string | null {
  const v = args.raw?.trim() ?? "";
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (isSafeOrgPublicCardImageStoredValue(v, args.orgId)) {
    return `/api/public/organizations/${args.slug}/card-media?type=image&key=${encodeURIComponent(v)}`;
  }
  return null;
}

export function resolvePublicCardVideoSource(args: {
  slug: string;
  orgId: string;
  raw: string | undefined | null;
}): AboutVideoRender | null {
  const v = args.raw?.trim() ?? "";
  if (!v) return null;

  const yt = youtubeEmbedSrc(v);
  if (yt) return { kind: "youtube", embedUrl: yt };

  if (/^https?:\/\//i.test(v)) {
    if (isBlobStoredRef(v)) return { kind: "video", src: v };
    if (/\.(mp4|webm)(\?[^#]*)?(#.*)?$/i.test(v)) return { kind: "video", src: v };
    return null;
  }

  if (isSafeOrgPublicCardVideoStoredValue(v, args.orgId)) {
    return {
      kind: "video",
      src: `/api/public/organizations/${args.slug}/card-media?type=video&key=${encodeURIComponent(v)}`,
    };
  }

  return null;
}
