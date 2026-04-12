import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import { getPlatformSiteIconHref } from "@/lib/platform/landing-settings";
import { getMetadataBase } from "@/lib/seo/metadata-base";
import { STATIC_BRAND_ASSET_VERSION, withStaticBrandCacheQuery } from "@/lib/seo/static-brand-asset-version";
import { toAbsoluteMetadataUrl } from "@/lib/seo/to-absolute-metadata-url";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const base = getMetadataBase();
  const href = await getPlatformSiteIconHref();
  const fallbackPath = withStaticBrandCacheQuery("/brand-icon.svg");
  const primaryIcon = href ? toAbsoluteMetadataUrl(href) : new URL(fallbackPath, base).toString();
  /** Real ICO — tab bar; PNGs are required for PWA “Install app” (Edge/Chrome ignore SVG/ICO there). */
  const icoAbs = new URL(withStaticBrandCacheQuery("/favicon.ico"), base).toString();
  const png192 = new URL(withStaticBrandCacheQuery("/icon-192.png"), base).toString();
  const png512 = new URL(withStaticBrandCacheQuery("/icon-512.png"), base).toString();
  const appleTouch = new URL(withStaticBrandCacheQuery("/apple-touch-icon.png"), base).toString();
  const iconList: { url: string; type?: string; sizes?: string }[] = [
    { url: icoAbs, type: "image/x-icon" },
    { url: png192, type: "image/png", sizes: "192x192" },
    { url: png512, type: "image/png", sizes: "512x512" },
  ];
  if (primaryIcon !== icoAbs && primaryIcon !== png192 && primaryIcon !== png512) {
    const svg = primaryIcon.includes(".svg") || primaryIcon.includes("brand-icon");
    iconList.push(svg ? { url: primaryIcon, type: "image/svg+xml" } : { url: primaryIcon });
  }
  const shortcutApple = [{ url: appleTouch, sizes: "180x180", type: "image/png" }];
  return {
    metadataBase: base,
    title: "SkillTech LMS",
    description: "Multi-tenant learning management platform",
    manifest: `/site.webmanifest?v=${STATIC_BRAND_ASSET_VERSION}`,
    icons: {
      icon: iconList,
      shortcut: shortcutApple,
      apple: shortcutApple,
    },
    appleWebApp: {
      capable: true,
      title: "SkillTech LMS",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
