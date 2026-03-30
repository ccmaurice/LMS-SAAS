import { isRemoteAvatarRef } from "@/lib/profile/avatar-storage";

/** Public URL for <img src> — remote URLs as-is, uploaded files via org API route. */
export function orgUserAvatarDisplayUrl(user: { id: string; image: string | null }): string | null {
  if (!user.image) return null;
  if (isRemoteAvatarRef(user.image)) return user.image;
  return `/api/users/${user.id}/avatar`;
}

/** Platform operator avatar (local files served from `/api/platform/me/avatar`). */
export function platformAvatarDisplayUrl(image: string | null): string | null {
  if (!image) return null;
  if (isRemoteAvatarRef(image)) return image;
  return `/api/platform/me/avatar`;
}
