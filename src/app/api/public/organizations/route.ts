import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveHeroImageSrc } from "@/lib/school-public";

/** Public list for marketing home carousel — no auth. */
export async function GET() {
  const orgs = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, heroImageUrl: true },
  });

  return NextResponse.json({
    organizations: orgs.map((o) => ({
      slug: o.slug,
      name: o.name,
      heroImageUrl: resolveHeroImageSrc({
        slug: o.slug,
        orgId: o.id,
        orgHeroImageUrl: o.heroImageUrl,
        cmsHeroImageUrl: undefined,
      }),
    })),
  });
}
