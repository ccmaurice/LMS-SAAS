import { getMetadataBase } from "@/lib/seo/metadata-base";

/**
 * Browsers and many crawlers expect absolute favicon / touch-icon URLs.
 * Resolves same-origin paths against `metadataBase` (see `getMetadataBase()` in `metadata-base.ts`).
 */
export function toAbsoluteMetadataUrl(href: string): string {
  const h = href.trim();
  if (/^https?:\/\//i.test(h)) return h;
  const base = getMetadataBase();
  const path = h.startsWith("/") ? h : `/${h}`;
  return new URL(path, base).toString();
}
