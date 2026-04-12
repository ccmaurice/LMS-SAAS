/**
 * Pure helpers for blob-stored upload refs (no Node fs). Safe to import from Client Components.
 */
export function isBlobStoredRef(ref: string): boolean {
  const u = ref.trim();
  return u.startsWith("https://") && u.includes("blob.vercel-storage.com");
}

/**
 * Block corporate Vercel *marketing* hosts when pasted as platform logo/favicon — those URLs show the Vercel
 * triangle in tabs. Tenant assets on Vercel Blob (`blob.vercel-storage.com`) and normal CDNs stay allowed.
 */
export function isAllowedPlatformExternalMediaUrl(ref: string): boolean {
  const u = ref.trim();
  if (!/^https?:\/\//i.test(u)) return true;
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (host === "vercel.com" || host === "www.vercel.com") return false;
    if (host === "assets.vercel.com") return false;
    return true;
  } catch {
    return false;
  }
}
