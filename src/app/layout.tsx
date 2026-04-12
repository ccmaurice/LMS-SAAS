import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import { getPlatformSiteIconHref } from "@/lib/platform/landing-settings";
import { getMetadataBase } from "@/lib/seo/metadata-base";
import { toAbsoluteMetadataUrl } from "@/lib/seo/to-absolute-metadata-url";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const base = getMetadataBase();
  const href = await getPlatformSiteIconHref();
  const fallbackPath = "/brand-icon.svg";
  const primaryIcon = href ? toAbsoluteMetadataUrl(href) : new URL(fallbackPath, base).toString();
  /** Real ICO — browsers often fetch `/favicon.ico` before parsing `link rel=icon` (SVG-only was unreliable). */
  const icoAbs = new URL("/favicon.ico", base).toString();
  const iconList: { url: string; type?: string }[] = [{ url: icoAbs, type: "image/x-icon" }];
  if (primaryIcon !== icoAbs) {
    const svg = primaryIcon.includes(".svg") || primaryIcon.includes("brand-icon");
    iconList.push(svg ? { url: primaryIcon, type: "image/svg+xml" } : { url: primaryIcon });
  }
  const shortcutApple = [{ url: primaryIcon }];
  return {
    metadataBase: base,
    title: "SaaS LMS",
    description: "Multi-tenant learning management platform",
    manifest: "/site.webmanifest",
    icons: {
      icon: iconList,
      shortcut: shortcutApple,
      apple: shortcutApple,
    },
    appleWebApp: {
      capable: true,
      title: "SaaS LMS",
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
