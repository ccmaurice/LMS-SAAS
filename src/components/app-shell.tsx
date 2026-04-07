import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { OrgWorkspaceLayout } from "@/components/layout/org-workspace-layout";

export function AppShell({
  slug,
  orgName,
  orgLogoUrl,
  educationLevel,
  user,
  role,
  children,
}: {
  slug: string;
  orgName: string;
  /** Resolved hero / CMS image URL for sidebar branding */
  orgLogoUrl?: string | null;
  educationLevel: EducationLevel;
  user: { id: string; name: string | null; email: string; image: string | null };
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <OrgWorkspaceLayout
      slug={slug}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      educationLevel={educationLevel}
      user={user}
      role={role}
    >
      {children}
    </OrgWorkspaceLayout>
  );
}
