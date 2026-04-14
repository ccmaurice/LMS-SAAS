"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        {children}
        <PublicLocaleFab />
        <Toaster richColors position="top-center" closeButton />
      </I18nProvider>
    </ThemeProvider>
  );
}

/** Language control on pages without org/platform header controls. */
function PublicLocaleFab() {
  const path = usePathname() ?? "";
  if (path.startsWith("/o/")) return null;
  if (path.startsWith("/platform")) return null;
  if (path === "/" || path === "/login" || path.startsWith("/register")) return null;

  return (
    <div className="fixed bottom-4 end-4 z-[200] print:hidden">
      <LocaleSwitcher layout="toolbar" />
    </div>
  );
}

