import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlatformOperator } from "@/lib/platform/session";
import { PlatformAvatar } from "@/components/profile/platform-avatar";
import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";
import { PlatformSignOutButton } from "@/components/platform/platform-sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Database,
  Globe,
  Settings,
  ShieldCheck
} from "lucide-react";

export default async function PlatformProtectedLayout({ children }: { children: React.ReactNode }) {
  const op = await getPlatformOperator();
  if (!op) {
    redirect("/platform/login");
  }

  const sidebarLinks = [
    { href: "/platform", label: "Overview", icon: LayoutDashboard },
    { href: "/platform", label: "Tenants", icon: Building2 },
    { href: "/platform/usage", label: "Analytics", icon: BarChart3 },
    { href: "/platform/database", label: "Database", icon: Database },
    { href: "/platform/landing", label: "Landing CMS", icon: Globe },
    { href: "/platform/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="relative min-h-screen flex bg-background text-foreground overflow-hidden">
      {/* Background Mesh */}
      <div className="pointer-events-none fixed inset-0 bg-app-mesh opacity-90 dark:opacity-100" aria-hidden />

      {/* Sidebar Layout */}
      <aside className="relative z-20 w-64 border-r border-border/60 bg-card/60 backdrop-blur-lg flex flex-col justify-between hidden md:flex">
        <div>
          {/* Sidebar Header */}
          <div className="p-6 border-b border-border/40 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm shadow-primary/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm tracking-wide leading-tight">SkillTech LMS</h2>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SUPER ADMIN</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {sidebarLinks.map((link, idx) => {
              const Icon = link.icon;
              return (
                <Link
                  key={idx}
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                >
                  <Icon className="size-4 text-muted-foreground/80" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer (Locale switcher only) */}
        <div className="p-4 border-t border-border/40 flex justify-center">
          <LocaleSwitcher layout="compact" />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/60 backdrop-blur-md px-6 py-4">
          <div className="flex items-center gap-3 md:hidden">
            <ShieldCheck className="size-6 text-primary" />
            <h1 className="font-semibold text-base">SkillTech LMS</h1>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Super Admin:</span>
            <span className="text-foreground font-semibold">C. C. Maurice</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/25 transition-all"
            >
              <Globe className="size-3.5" />
              View Site
            </Link>
            <ThemeToggle variant="ghost" />
            <PlatformNotificationBell />
            
            {/* Operator Profile Bubble & Signout */}
            <div className="flex items-center gap-3 border-l border-border/60 pl-4">
              <PlatformAvatar email={op.email} image={op.image} size={32} />
              <div className="hidden xl:block text-left text-xs">
                <p className="font-semibold leading-tight">C. C. Maurice</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{op.email}</p>
              </div>
              <PlatformSignOutButton />
            </div>
          </div>
        </header>

        {/* Dashboard Pages Root */}
        <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
