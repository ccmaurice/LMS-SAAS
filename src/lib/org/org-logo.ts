import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  isSafeOrgCmsHeroKey,
  isSafeOrgHeroSettingKey,
  isSafeOrgLogoSettingKey,
} from "@/lib/org/public-assets";
import { resolveHeroImageSrc } from "@/lib/school-public";
import { loadUpload } from "@/lib/uploads/storage";

const CMS_HERO_KEY = "school.public.hero.imageUrl";

export function resolveOrgLogoPublicUrl(slug: string, orgId: string, logoImageUrl: string | null): string | null {
  const raw = logoImageUrl?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (isSafeOrgLogoSettingKey(raw, orgId)) {
    return `/api/public/organizations/${slug}/logo`;
  }
  return null;
}

/** Deduped per request — safe to call from layout + page. */
export type GetOrganizationLogoUrlOpts = {
  /** When passed (including `undefined` value), skips the CMS DB read and uses this for the CMS hero slot. */
  cmsHeroImageUrl?: string | null;
};

export const getOrganizationLogoUrl = cache(
  async (
    organizationId: string,
    slug: string,
    logoImageUrl: string | null,
    heroImageUrl: string | null,
    opts?: GetOrganizationLogoUrlOpts,
  ): Promise<string | null> => {
    const fromLogo = resolveOrgLogoPublicUrl(slug, organizationId, logoImageUrl);
    if (fromLogo) return fromLogo;

    let cmsValue: string | undefined;
    if (opts && "cmsHeroImageUrl" in opts) {
      const raw = opts.cmsHeroImageUrl;
      cmsValue = raw == null || raw === "" ? undefined : raw.trim() || undefined;
    } else {
      cmsValue =
        (
          await prisma.cmsEntry.findUnique({
            where: { organizationId_key: { organizationId, key: CMS_HERO_KEY } },
            select: { value: true },
          })
        )?.value?.trim() || undefined;
    }

    return resolveHeroImageSrc({
      slug,
      orgId: organizationId,
      orgHeroImageUrl: heroImageUrl,
      cmsHeroImageUrl: cmsValue,
    });
  },
);

/** Load raw bytes for PDF embedding (same source priority as {@link getOrganizationLogoUrl}). */
export async function loadOrganizationLogoBuffer(args: {
  organizationId: string;
  slug: string;
  logoImageUrl: string | null;
  heroImageUrl: string | null;
}): Promise<Buffer | null> {
  const cms = await prisma.cmsEntry.findUnique({
    where: { organizationId_key: { organizationId: args.organizationId, key: CMS_HERO_KEY } },
    select: { value: true },
  });

  const fetchOrLoad = async (
    raw: string | null | undefined,
    keyOk: (key: string, orgId: string) => boolean,
  ): Promise<Buffer | null> => {
    const v = raw?.trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) {
      try {
        const res = await fetch(v);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
      } catch {
        return null;
      }
    }
    if (keyOk(v, args.organizationId)) {
      return (await loadUpload(v)) ?? null;
    }
    return null;
  };

  const fromLogo = await fetchOrLoad(args.logoImageUrl, isSafeOrgLogoSettingKey);
  if (fromLogo?.length) return fromLogo;

  const fromCms = await fetchOrLoad(cms?.value, (k, id) => isSafeOrgCmsHeroKey(k, id));
  if (fromCms?.length) return fromCms;

  const fromHero = await fetchOrLoad(args.heroImageUrl, (k, id) => isSafeOrgHeroSettingKey(k, id));
  return fromHero?.length ? fromHero : null;
}
