import path from "node:path";

import { isBlobStoredRef } from "@/lib/uploads/blob-ref";

/** Favicons are small; keep uploads tight. */
export const MAX_PLATFORM_FAVICON_BYTES = 512 * 1024;

const FAVICON_MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
  "image/svg+xml": ".svg",
};

export function extForFaviconMime(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  return FAVICON_MIME_TO_EXT[m] ?? null;
}

export function platformFaviconStorageKey(ext: string): string {
  return path.posix.join("platform", "landing", `favicon${ext}`);
}

export function isSafePlatformFaviconKey(key: string): boolean {
  if (key.includes("..") || key.length > 200) return false;
  return /^platform\/landing\/favicon\.(jpe?g|png|webp|gif|ico|svg)$/i.test(key);
}

export function isSafePlatformFaviconStoredValue(key: string): boolean {
  return isBlobStoredRef(key) || isSafePlatformFaviconKey(key);
}
