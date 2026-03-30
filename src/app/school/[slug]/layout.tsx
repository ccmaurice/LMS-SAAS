import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrgBrandingScope } from "@/components/org-branding-scope";

export default async function SchoolPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      slug: true,
      themeTemplate: true,
      customPrimaryHex: true,
      customAccentHex: true,
    },
  });

  if (!org) notFound();

  return (
    <OrgBrandingScope slug={org.slug} org={org}>
      <div className="flex min-h-full flex-1 flex-col bg-background">{children}</div>
    </OrgBrandingScope>
  );
}
