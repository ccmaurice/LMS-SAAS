"use client";

import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { SidebarNav } from "@/components/nav/sidebar-nav";

/** Shared branding + nav list for desktop sidebar and mobile sheet. */
export function OrgSidebarPanel({
  base,
  slug,
  orgName,
  orgLogoUrl,
  role,
  educationLevel,
}: {
  base: string;
  slug: string;
  orgName: string;
  orgLogoUrl?: string | null;
  educationLevel: EducationLevel;
  role: Role;
}) {
  return (
    <>
      <div className="border-b border-border/60 px-4 py-5 dark:border-white/10">
        <OrgBrandMark
          url={orgLogoUrl}
          size="sm"
          adaptMonochromeDarkMode
          className="mb-3 max-w-[180px]"
        />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">School</p>
        <p className="mt-1 truncate text-sm font-semibold tracking-tight">{orgName}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">/{slug}</p>
      </div>
      <SidebarNav base={base} role={role} orgSlug={slug} educationLevel={educationLevel} />
    </>
  );
}
