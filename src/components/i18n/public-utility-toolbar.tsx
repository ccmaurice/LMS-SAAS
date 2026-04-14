"use client";

import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/** Top-right locale + theme cluster for public and auth pages (replaces bottom FAB on those routes). */
export function PublicUtilityToolbar() {
  return (
    <div className="flex items-center gap-1.5">
      <LocaleSwitcher layout="compact" />
      <ThemeToggle variant="outlined" />
    </div>
  );
}
