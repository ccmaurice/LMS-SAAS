"use client";

import { Toaster } from "sonner";
import { GoogleTranslateProvider } from "@/components/translate/google-translate-provider";
import { SiteTranslateFabPublic } from "@/components/translate/site-translate-menu";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <GoogleTranslateProvider>
        {children}
        <SiteTranslateFabPublic />
        <Toaster richColors position="top-center" closeButton />
      </GoogleTranslateProvider>
    </ThemeProvider>
  );
}
