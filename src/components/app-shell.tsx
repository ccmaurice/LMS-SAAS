import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { UserAvatar } from "@/components/profile/user-avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { OrgCommandMenu } from "@/components/org-command-menu";
import { OrgMobileNav } from "@/components/org-mobile-nav";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { OrgPageTransition } from "@/components/layout/org-page-transition";

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
  const base = `/o/${slug}`;

  return (
    <div className="relative flex min-h-full flex-1 print:h-auto print:min-h-0 print:overflow-visible">
      <div
        className="pointer-events-none fixed inset-0 bg-app-mesh opacity-90 print:hidden dark:opacity-100"
        aria-hidden
      />
      <aside className="relative z-10 hidden w-60 shrink-0 border-r border-border/70 bg-card/40 shadow-sm backdrop-blur-xl print:hidden dark:border-white/10 dark:bg-card/30 md:flex md:flex-col">
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
      </aside>
      <div className="relative z-10 flex min-w-0 min-h-0 flex-1 flex-col print:h-auto print:min-h-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 shadow-sm backdrop-blur-md print:hidden dark:border-white/10 dark:bg-background/55 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar user={user} size={40} />
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{user.name?.trim() || user.email}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="capitalize">{role.toLowerCase()}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OrgCommandMenu slug={slug} role={role} educationLevel={educationLevel} />
            <NotificationBell slug={slug} />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 overflow-visible p-4 pb-24 md:p-8 md:pb-8 print:h-auto print:max-h-none print:overflow-visible print:pb-6">
          <div className="mx-auto w-full max-w-7xl print:max-w-none">
            <OrgPageTransition>{children}</OrgPageTransition>
          </div>
        </main>
      </div>
      <div className="print:hidden">
        <OrgMobileNav slug={slug} role={role} educationLevel={educationLevel} />
      </div>
    </div>
  );
}
