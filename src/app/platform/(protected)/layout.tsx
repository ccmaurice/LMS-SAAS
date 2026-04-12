import Link from "next/link";
import { redirect } from "next/navigation";
import { PlatformAvatar } from "@/components/profile/platform-avatar";
import { getPlatformOperator } from "@/lib/platform/session";
import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";
import { PlatformSignOutButton } from "@/components/platform/platform-sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function PlatformProtectedLayout({ children }: { children: React.ReactNode }) {
  const op = await getPlatformOperator();
  if (!op) {
    redirect("/platform/login");
  }

  return (
    <div className="relative min-h-full flex-1">
      <div className="pointer-events-none fixed inset-0 bg-app-mesh opacity-90 dark:opacity-100" aria-hidden />
      <div className="relative z-10 flex min-h-full flex-col">
        <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/70 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-background/50 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <PlatformAvatar email={op.email} image={op.image} size={40} />
            <div className="min-w-0">
              <Link href="/platform" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
                Platform operator
              </Link>
              <p className="truncate text-xs text-muted-foreground">Cross-tenant console · {op.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              View site
            </Link>
            <Link href="/platform/landing" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Landing page
            </Link>
            <Link href="/platform/usage" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Usage & analysis
            </Link>
            <Link href="/platform/database" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Database
            </Link>
            <Link href="/platform/settings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Settings
            </Link>
            <PlatformNotificationBell />
            <ThemeToggle />
            <PlatformSignOutButton />
          </div>
        </header>
        <main className="relative z-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
