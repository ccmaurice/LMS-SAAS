import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // pdfkit loads metric files from disk; bundling it breaks at runtime (500 on PDF routes).
  serverExternalPackages: ["pdfkit"],
  // Faster dev / compile: tree-shake icon barrel imports; avoid Google Fonts fetch in `next/font/google`.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Browsers still request /favicon.ico by convention; without this they may 404 and keep an old or generic tab icon.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/brand-icon.svg" }];
  },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
