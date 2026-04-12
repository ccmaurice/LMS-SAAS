import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import { getMetadataBase } from "@/lib/seo/metadata-base";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "SaaS LMS",
  description: "Multi-tenant learning management platform",
  manifest: "/site.webmanifest",
  /** Default tab icon — avoids host/generic fallbacks (e.g. Vercel triangle on *.vercel.app). Overridden by / when platform logo is set, and by /o/[slug] when a school logo exists. */
  icons: {
    icon: [{ url: "/brand-icon.svg", type: "image/svg+xml" }],
    shortcut: ["/brand-icon.svg"],
    apple: [{ url: "/brand-icon.svg" }],
  },
  appleWebApp: {
    capable: true,
    title: "SaaS LMS",
  },
};

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
