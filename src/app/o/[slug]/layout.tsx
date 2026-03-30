import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { OrgBrandingScope } from "@/components/org-branding-scope";

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
    },
  });
  if (!org) notFound();

  const user = await getCurrentUser();
  if (!user || user.organizationId !== org.id) {
    redirect(`/login?org=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(`/o/${slug}/dashboard`)}`);
  }

  return (
    <OrgBrandingScope slug={slug} org={org}>
      <AppShell
        slug={slug}
        orgName={org.name}
        user={{ id: user.id, name: user.name, email: user.email, image: user.image }}
        role={user.role}
      >
        {children}
      </AppShell>
    </OrgBrandingScope>
  );
}
