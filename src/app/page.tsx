import type { Metadata } from "next";
import { HomeLanding } from "@/components/marketing/home-landing";
import { prisma } from "@/lib/db";
import { getPublicLandingPayload } from "@/lib/platform/landing-settings";
import { isPrismaPublicFallbackError } from "@/lib/prisma-errors";
import { toAbsoluteMetadataUrl } from "@/lib/seo/to-absolute-metadata-url";
import { resolveHeroImageSrc } from "@/lib/school-public";

/** Avoid DB access during `next build` when MySQL is not running. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const landing = await getPublicLandingPayload();
  if (!landing.logoSrc) {
    return {};
  }
  const abs = toAbsoluteMetadataUrl(landing.logoSrc);
  return {
    icons: {
      icon: [{ url: abs, rel: "icon" }],
      shortcut: [{ url: abs }],
      apple: [{ url: abs }],
    },
  };
}

export default async function Home() {
  const landing = await getPublicLandingPayload();

  let schools: { id: string; slug: string; name: string; heroImageUrl: string | null }[] = [];
  try {
    schools = await prisma.organization.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, heroImageUrl: true },
    });
  } catch (e) {
    if (!isPrismaPublicFallbackError(e)) throw e;
  }

  const items = schools.map((s) => ({
    slug: s.slug,
    name: s.name,
    heroImageUrl: resolveHeroImageSrc({
      slug: s.slug,
      orgId: s.id,
      orgHeroImageUrl: s.heroImageUrl,
      cmsHeroImageUrl: undefined,
    }),
  }));

  return (
    <HomeLanding
      schools={items}
      logoSrc={landing.logoSrc}
      kicker={landing.kicker}
      headline={landing.headline}
      subheadline={landing.subheadline}
      features={landing.features}
    />
  );
}
