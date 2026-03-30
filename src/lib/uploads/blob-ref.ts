/**
 * Pure helpers for blob-stored upload refs (no Node fs). Safe to import from Client Components.
 */
export function isBlobStoredRef(ref: string): boolean {
  const u = ref.trim();
  return u.startsWith("https://") && u.includes("blob.vercel-storage.com");
}
