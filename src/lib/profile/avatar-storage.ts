import { createHash, randomUUID } from "node:crypto";
import { AVATAR_MIME_TO_EXT, extForAvatarMime, isRemoteAvatarRef } from "./avatar-mime";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export { AVATAR_MIME_TO_EXT, extForAvatarMime, isRemoteAvatarRef };

export function userAvatarStorageKey(userId: string, fileId: string, ext: string): string {
  return `avatars/users/${userId}/${fileId}${ext}`;
}

export function isSafeUserAvatarKey(key: string, userId: string): boolean {
  if (key.includes("..") || key.length > 400) return false;
  const prefix = `avatars/users/${userId}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  return /^[a-f0-9-]{36}\.(jpe?g|png|webp|gif)$/i.test(rest);
}

export function platformAvatarKeyPrefix(email: string): string {
  const hash = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
  return `avatars/platform/${hash}`;
}

export function platformAvatarStorageKey(email: string, ext: string): string {
  return `${platformAvatarKeyPrefix(email)}${ext}`;
}

export function isSafePlatformAvatarKey(key: string, email: string): boolean {
  if (key.includes("..") || key.length > 400) return false;
  const prefix = platformAvatarKeyPrefix(email);
  return key.startsWith(`${prefix}.`) && /^avatars\/platform\/[a-f0-9]{32}\.(jpe?g|png|webp|gif)$/i.test(key);
}

export function newAvatarFileId(): string {
  return randomUUID();
}
