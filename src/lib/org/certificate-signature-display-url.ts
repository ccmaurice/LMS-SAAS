/**
 * Image `src` for a certificate signature stored as an uploaded org key or external https URL.
 */
export function certificateSignatureImageDisplayUrl(
  orgSlug: string,
  raw: string | undefined | null,
): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("orgs/")) {
    return `/api/public/organizations/${encodeURIComponent(orgSlug)}/certificate-signature`;
  }
  return null;
}
