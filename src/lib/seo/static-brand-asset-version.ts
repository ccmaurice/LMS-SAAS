/**
 * Query suffix for public brand icons / manifest. Browsers and CDNs cache favicons very aggressively;
 * bump this when you replace `public/favicon.ico`, `icon-*.png`, or `site.webmanifest` so clients refetch.
 */
export const STATIC_BRAND_ASSET_VERSION = "5";

export function withStaticBrandCacheQuery(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.includes("?") ? p : `${p}?v=${STATIC_BRAND_ASSET_VERSION}`;
}
