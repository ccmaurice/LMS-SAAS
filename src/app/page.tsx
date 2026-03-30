import { HomeLanding } from "@/components/marketing/home-landing";
import { prisma } from "@/lib/db";
import { getPublicLandingPayload } from "@/lib/platform/landing-settings";
import { resolveHeroImageSrc } from "@/lib/school-public";

/** Avoid DB access during `next build` when MySQL is not running. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const [landing, schools] = await Promise.all([
    getPublicLandingPayload(),
    prisma.organization.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, heroImageUrl: true },
    }),
  ]);

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
