"use client";

import { Toaster } from "sonner";
import { SiteTranslateWidget } from "@/components/site-translate-widget";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <SiteTranslateWidget />
      <Toaster richColors position="top-center" closeButton />
    </ThemeProvider>
  );
}
