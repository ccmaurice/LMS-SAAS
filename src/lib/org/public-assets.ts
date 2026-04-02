import { randomUUID } from "node:crypto";
import path from "node:path";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";

export const MAX_ORG_HERO_BYTES = 8 * 1024 * 1024;
export const MAX_ABOUT_VIDEO_BYTES = 45 * 1024 * 1024;

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

export function extForAboutVideoMime(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  return VIDEO_MIME_TO_EXT[m] ?? null;
}

function escapeOrgId(orgId: string): string {
  return orgId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Single on-disk hero for School settings (`organization.heroImageUrl`). */
export function orgHeroSettingPath(orgId: string, ext: string): string {
  return path.posix.join("orgs", orgId, `hero${ext}`);
}

/** Brand logo for School settings (`organization.logoImageUrl`) — transcripts, sidebar, PDFs, etc. */
export function orgLogoSettingPath(orgId: string, ext: string): string {
  return path.posix.join("orgs", orgId, `logo${ext}`);
}

export function isSafeOrgHeroSettingKey(key: string, orgId: string): boolean {
  if (key.includes("..") || key.length > 500) return false;
  const re = new RegExp(`^orgs/${escapeOrgId(orgId)}/hero\\.(jpe?g|png|webp|gif)$`, "i");
  return re.test(key);
}

export function isSafeOrgLogoSettingKey(key: string, orgId: string): boolean {
  if (key.includes("..") || key.length > 500) return false;
  const re = new RegExp(`^orgs/${escapeOrgId(orgId)}/logo\\.(jpe?g|png|webp|gif)$`, "i");
  return re.test(key);
}

export function orgCmsHeroStorageKey(orgId: string, ext: string): string {
  return path.posix.join("orgs", orgId, "public", `cms-hero-${randomUUID()}${ext}`);
}

export function isSafeOrgCmsHeroKey(key: string, orgId: string): boolean {
  if (key.includes("..") || key.length > 500) return false;
  const re = new RegExp(
    `^orgs/${escapeOrgId(orgId)}/public/cms-hero-[a-f0-9-]{36}\\.(jpe?g|png|webp|gif)$`,
    "i",
  );
  return re.test(key);
}

export function orgAboutVideoStorageKey(orgId: string, ext: string): string {
  return path.posix.join("orgs", orgId, "public", `about-${randomUUID()}${ext}`);
}

export function isSafeOrgAboutVideoKey(key: string, orgId: string): boolean {
  if (key.includes("..") || key.length > 500) return false;
  const re = new RegExp(
    `^orgs/${escapeOrgId(orgId)}/public/about-[a-f0-9-]{36}\\.(mp4|webm)$`,
    "i",
  );
  return re.test(key);
}

/** Public school page custom section cards — uploaded images (CMS JSON references this key). */
export function orgPublicCardImageStorageKey(orgId: string, ext: string): string {
  return path.posix.join("orgs", orgId, "public", `card-img-${randomUUID()}${ext}`);
}

export function isSafeOrgPublicCardImageKey(key: string, orgId: string): boolean {
  if (key.includes("..") || key.length > 500) return false;
  const re = new RegExp(
    `^orgs/${escapeOrgId(orgId)}/public/card-img-[a-f0-9-]{36}\\.(jpe?g|png|webp|gif)$`,
    "i",
  );
  return re.test(key);
}

export function orgPublicCardVideoStorageKey(orgId: string, ext: string): string {
  return path.posix.join("orgs", orgId, "public", `card-vid-${randomUUID()}${ext}`);
}

export function isSafeOrgPublicCardVideoKey(key: string, orgId: string): boolean {
  if (key.includes("..") || key.length > 500) return false;
  const re = new RegExp(
    `^orgs/${escapeOrgId(orgId)}/public/card-vid-[a-f0-9-]{36}\\.(mp4|webm)$`,
    "i",
  );
  return re.test(key);
}

export function isSafeOrgCmsHeroStoredValue(key: string, orgId: string): boolean {
  return isBlobStoredRef(key) || isSafeOrgCmsHeroKey(key, orgId);
}

export function isSafeOrgAboutVideoStoredValue(key: string, orgId: string): boolean {
  return isBlobStoredRef(key) || isSafeOrgAboutVideoKey(key, orgId);
}

export function isSafeOrgHeroSettingStoredValue(key: string, orgId: string): boolean {
  return isBlobStoredRef(key) || isSafeOrgHeroSettingKey(key, orgId);
}

export function isSafeOrgLogoSettingStoredValue(key: string, orgId: string): boolean {
  return isBlobStoredRef(key) || isSafeOrgLogoSettingKey(key, orgId);
}

export function isSafeOrgPublicCardImageStoredValue(key: string, orgId: string): boolean {
  return isBlobStoredRef(key) || isSafeOrgPublicCardImageKey(key, orgId);
}

export function isSafeOrgPublicCardVideoStoredValue(key: string, orgId: string): boolean {
  return isBlobStoredRef(key) || isSafeOrgPublicCardVideoKey(key, orgId);
}
