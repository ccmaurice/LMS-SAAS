import path from "node:path";

import { extForAvatarMime } from "@/lib/profile/avatar-storage";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";

export const MAX_PLATFORM_LOGO_BYTES = 2 * 1024 * 1024;

export function platformLogoStorageKey(ext: string): string {
  return path.posix.join("platform", "landing", `logo${ext}`);
}

export function isSafePlatformLogoKey(key: string): boolean {
  if (key.includes("..") || key.length > 200) return false;
  return /^platform\/landing\/logo\.(jpe?g|png|webp|gif)$/i.test(key);
}

export function isSafePlatformLogoStoredValue(key: string): boolean {
  return isBlobStoredRef(key) || isSafePlatformLogoKey(key);
}

export { extForAvatarMime };
