"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { PwaRegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { WhatsappSupportFab } from "@/components/support/whatsapp-support-fab";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <PwaRegisterServiceWorker />
        {children}
        <FloatingCornerActions />
        <Toaster richColors position="top-center" closeButton />
      </I18nProvider>
    </ThemeProvider>
  );
}

/**
 * Bottom-end stack: optional locale toolbar (public routes) + WhatsApp support.
 * WhatsApp sits closest to the corner; locale sits above when shown.
 */
function FloatingCornerActions() {
  const path = usePathname() ?? "";
  const showLocaleToolbar =
    !path.startsWith("/o/") &&
    !path.startsWith("/platform") &&
    path !== "/" &&
    path !== "/login" &&
    !path.startsWith("/register");

  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[200] flex flex-col items-end gap-3 print:hidden">
      {showLocaleToolbar ? (
        <div className="pointer-events-auto">
          <LocaleSwitcher layout="toolbar" />
        </div>
      ) : null}
      <div className="pointer-events-auto">
        <WhatsappSupportFab />
      </div>
    </div>
  );
}

