import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { OrgBrandingScope } from "@/components/org-branding-scope";
import { getOrganizationLogoUrl } from "@/lib/org/org-logo";
import { toAbsoluteMetadataUrl } from "@/lib/seo/to-absolute-metadata-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true, logoImageUrl: true, heroImageUrl: true },
  });
  if (!org) return {};
  const logoUrl = await getOrganizationLogoUrl(org.id, org.slug, org.logoImageUrl, org.heroImageUrl);
  if (!logoUrl) return {};
  const abs = toAbsoluteMetadataUrl(logoUrl);
  return {
    icons: {
      icon: [{ url: abs, rel: "icon" }],
      shortcut: [{ url: abs }],
      apple: [{ url: abs }],
    },
  };
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      themeTemplate: true,
      customPrimaryHex: true,
      customAccentHex: true,
      educationLevel: true,
      heroImageUrl: true,
      logoImageUrl: true,
    },
  });
  if (!org) notFound();

  const orgLogoUrl = await getOrganizationLogoUrl(org.id, org.slug, org.logoImageUrl, org.heroImageUrl);

  const user = await getCurrentUser();
  if (!user || user.organizationId !== org.id) {
    redirect(`/login?org=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(`/o/${slug}/dashboard`)}`);
  }

  return (
    <OrgBrandingScope slug={slug} org={org}>
      <AppShell
        slug={slug}
        orgName={org.name}
        orgLogoUrl={orgLogoUrl}
        educationLevel={org.educationLevel}
        user={{ id: user.id, name: user.name, email: user.email, image: user.image }}
        role={user.role}
      >
        {children}
      </AppShell>
    </OrgBrandingScope>
  );
}
