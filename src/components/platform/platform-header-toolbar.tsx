"use client";

import Link from "next/link";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";
import { PlatformSignOutButton } from "@/components/platform/platform-sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function PlatformHeaderToolbar() {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("platform.viewSite")}
      </Link>
      <Link href="/platform/landing" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("platform.landing")}
      </Link>
      <Link href="/platform/usage" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("platform.usage")}
      </Link>
      <Link href="/platform/database" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("platform.database")}
      </Link>
      <Link href="/platform/settings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("platform.settings")}
      </Link>
      <PlatformNotificationBell />
      <LocaleSwitcher layout="compact" />
      <ThemeToggle />
      <PlatformSignOutButton />
    </div>
  );
}
