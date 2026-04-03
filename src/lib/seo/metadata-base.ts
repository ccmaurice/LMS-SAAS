/**
 * Canonical base URL for metadata, OAuth redirects, invite emails, certificate QR codes, etc.
 *
 * Priority:
 * 1. `NEXT_PUBLIC_APP_URL` — explicit override (recommended: set to `https://your-domain.com` in Vercel Production).
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` — **production only**; Vercel sets this to the primary production hostname
 *    (your custom domain once assigned, otherwise `*.vercel.app`). Not used for Preview so deploy URLs stay correct.
 * 3. `VERCEL_URL` — current deployment host (preview or production).
 */
export function getMetadataBase(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit.replace(/\/$/, ""));
    } catch {
      /* fall through */
    }
  }
  const vercelEnv = process.env.VERCEL_ENV;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelEnv === "production" && productionHost) {
    try {
      const host = productionHost.replace(/^https?:\/\//i, "");
      return new URL(`https://${host}`);
    } catch {
      /* fall through */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    try {
      return new URL(`https://${vercel.replace(/^https?:\/\//i, "")}`);
    } catch {
      /* fall through */
    }
  }
  return new URL("http://localhost:3000");
}

/** Public absolute origin for links and QR codes (same resolution as metadata base). */
export function getAppOrigin(): string {
  return getMetadataBase().origin;
}
