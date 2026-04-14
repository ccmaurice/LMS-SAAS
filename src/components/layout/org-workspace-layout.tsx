"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Flag,
  Maximize2,
  Menu,
  Minimize2,
  PanelLeftClose,
  X,
} from "lucide-react";
import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { UserAvatar } from "@/components/profile/user-avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { OrgCommandMenu } from "@/components/org-command-menu";
import { OrgMobileNav } from "@/components/org-mobile-nav";
import { OrgSidebarPanel } from "@/components/layout/org-sidebar-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { useI18n } from "@/components/i18n/i18n-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { OrgPageTransition } from "@/components/layout/org-page-transition";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const sidebarStorageKey = (slug: string) => `org-workspace-sidebar:${slug}`;

export function OrgWorkspaceLayout({
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
  orgLogoUrl?: string | null;
  educationLevel: EducationLevel;
  user: { id: string; name: string | null; email: string; image: string | null };
  role: Role;
  children: React.ReactNode;
}) {
  const base = `/o/${slug}`;
  const pathname = usePathname();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(sidebarStorageKey(slug));
      if (v === "1") setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, [slug]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const persistSidebar = useCallback(
    (collapsed: boolean) => {
      setSidebarCollapsed(collapsed);
      try {
        localStorage.setItem(sidebarStorageKey(slug), collapsed ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [slug],
  );

  const toggleSidebar = useCallback(() => {
    persistSidebar(!sidebarCollapsed);
  }, [persistSidebar, sidebarCollapsed]);

  const toggleFullscreen = useCallback(async () => {
    const el = workspaceRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        persistSidebar(true);
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* Safari / denied */
    }
  }, [persistSidebar]);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-full flex-1 print:h-auto print:min-h-0 print:overflow-visible">
      <div
        className="pointer-events-none fixed inset-0 bg-app-mesh opacity-90 print:hidden dark:opacity-100"
        aria-hidden
      />
      <div
        ref={workspaceRef}
        className={cn(
          "relative z-10 flex min-h-0 min-w-0 flex-1 print:h-auto print:min-h-0",
          fullscreen && "bg-background",
        )}
      >
        <aside
          id="org-sidebar"
          aria-hidden={sidebarCollapsed ? true : undefined}
          className={cn(
            "relative z-10 hidden shrink-0 flex-col border-r border-border/70 bg-card/40 shadow-sm backdrop-blur-xl transition-[width,opacity,border-color] duration-200 ease-out print:hidden dark:border-white/10 dark:bg-card/30 md:flex",
            sidebarCollapsed
              ? "md:w-0 md:min-w-0 md:overflow-hidden md:border-transparent md:opacity-0 md:pointer-events-none"
              : "md:w-60 md:opacity-100",
          )}
        >
          <OrgSidebarPanel
            base={base}
            slug={slug}
            orgName={orgName}
            orgLogoUrl={orgLogoUrl}
            role={role}
            educationLevel={educationLevel}
          />
        </aside>

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col print:h-auto print:min-h-0">
          <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-3 py-2.5 shadow-sm backdrop-blur-md print:hidden dark:border-white/10 dark:bg-background/60 md:px-5 md:py-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:gap-3">
              {/* Mobile: menu + fullscreen + optional logo chip */}
              <div className="flex items-center gap-1.5 md:hidden">
                {orgLogoUrl ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card/50 dark:border-white/10">
                    <OrgBrandMark
                      url={orgLogoUrl}
                      size="sm"
                      adaptMonochromeDarkMode
                      className="max-h-7 max-w-7 object-contain"
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="shrink-0 rounded-lg border-border/80 bg-background shadow-xs"
                  aria-expanded={mobileMenuOpen}
                  aria-controls="org-mobile-nav-sheet"
                  title={t("shell.openFullMenu")}
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="size-[1.15rem]" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="shrink-0 rounded-lg border-border/80 bg-background shadow-xs"
                  aria-pressed={fullscreen}
                  title={fullscreen ? t("shell.exitFullscreen") : t("shell.fullscreenMobile")}
                  onClick={() => void toggleFullscreen()}
                >
                  {fullscreen ? (
                    <Minimize2 className="size-[1.15rem]" aria-hidden />
                  ) : (
                    <Maximize2 className="size-[1.15rem]" aria-hidden />
                  )}
                </Button>
              </div>

              {/* Desktop: panel toggle + fullscreen */}
              <div className="hidden items-center gap-1.5 md:flex">
                {sidebarCollapsed && orgLogoUrl ? (
                  <div className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card/50 dark:border-white/10">
                    <OrgBrandMark
                      url={orgLogoUrl}
                      size="sm"
                      adaptMonochromeDarkMode
                      className="max-h-7 max-w-7 object-contain"
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="shrink-0 rounded-lg border-border/80 bg-background shadow-xs"
                  aria-expanded={!sidebarCollapsed}
                  aria-controls="org-sidebar"
                  title={sidebarCollapsed ? t("shell.showMenuPanel") : t("shell.hideMenuPanel")}
                  onClick={toggleSidebar}
                >
                  {sidebarCollapsed ? (
                    <Menu className="size-[1.15rem]" aria-hidden />
                  ) : (
                    <PanelLeftClose className="size-[1.15rem]" aria-hidden />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="shrink-0 rounded-lg border-border/80 bg-background shadow-xs"
                  aria-pressed={fullscreen}
                  title={fullscreen ? t("shell.exitFullscreen") : t("shell.fullscreenDesktop")}
                  onClick={() => void toggleFullscreen()}
                >
                  {fullscreen ? (
                    <Minimize2 className="size-[1.15rem]" aria-hidden />
                  ) : (
                    <Maximize2 className="size-[1.15rem]" aria-hidden />
                  )}
                </Button>
              </div>

              <div className="flex min-w-0 items-center gap-2.5 pl-0 md:pl-1">
                <UserAvatar user={user} size={40} />
                <p className="min-w-0 truncate text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{user.name?.trim() || user.email}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span>{t(`shell.role.${role}`)}</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
              <Link
                href={`${base}/dashboard#school-calendar`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "text-muted-foreground hover:text-foreground",
                )}
                title={t("shell.schoolCalendarOnDashboard")}
                aria-label={t("shell.schoolCalendar")}
              >
                <CalendarDays className="size-[1.15rem]" />
              </Link>
              <Link
                href={`${base}/report-card`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "text-muted-foreground hover:text-foreground",
                )}
                title={t("shell.reportCard")}
                aria-label={t("shell.reportCard")}
              >
                <Flag className="size-[1.15rem]" />
              </Link>
              <OrgCommandMenu slug={slug} role={role} educationLevel={educationLevel} />
              <NotificationBell slug={slug} />
              <LocaleSwitcher layout="compact" />
              <ThemeToggle variant="outlined" />
              <SignOutButton />
            </div>
          </header>

          <main className="relative z-0 flex-1 overflow-visible p-4 pb-24 md:p-8 md:pb-8 print:h-auto print:max-h-none print:overflow-visible print:pb-6">
            <div className="mx-auto w-full max-w-7xl print:max-w-none">
              <OrgPageTransition>{children}</OrgPageTransition>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile slide-over: full sidebar nav */}
      {mobileMenuOpen ? (
        <div className="print:hidden md:hidden">
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
                aria-label={t("shell.closeMenu")}
                onClick={closeMobileMenu}
          />
          <div
            id="org-mobile-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("shell.mainMenu")}
            className="fixed inset-y-0 left-0 z-[70] flex max-h-[100dvh] w-[min(20rem,92vw)] flex-col border-r border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl dark:border-white/12"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 dark:border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("shell.menu")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <OrgSidebarPanel
                base={base}
                slug={slug}
                orgName={orgName}
                orgLogoUrl={orgLogoUrl}
                role={role}
                educationLevel={educationLevel}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="print:hidden">
        <OrgMobileNav slug={slug} role={role} educationLevel={educationLevel} />
      </div>
    </div>
  );
}
