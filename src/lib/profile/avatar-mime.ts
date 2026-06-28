export const AVATAR_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function extForAvatarMime(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  return AVATAR_MIME_TO_EXT[m] ?? null;
}

export function isRemoteAvatarRef(image: string): boolean {
  return /^https?:\/\//i.test(image.trim());
}
