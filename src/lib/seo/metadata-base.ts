/**
 * Canonical base URL for metadata, OAuth redirects, invite emails, certificate QR codes, etc.
 *
 * Priority:
 * 1. `NEXT_PUBLIC_APP_URL` — explicit override (recommended: set to `https://your-domain.com` in Vercel Production).
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` — **production only**; Vercel sets this to the primary production hostname
 *    (your custom domain once assigned, otherwise `*.vercel.app`). Not used for Preview so deploy URLs stay correct.
 * 3. `VERCEL_URL` — current deployment host (preview or production).
 *
 * If `NEXT_PUBLIC_APP_URL` is still `http://localhost:3000` on Vercel (common copy-paste from `.env.example`),
 * it is ignored in **production** and **preview** so certificate QR / verify links use the real deployment host.
 */
function isLocalDevHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
}

function shouldIgnoreExplicitAppUrlInVercel(explicit: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(explicit.replace(/\/$/, "")).hostname;
  } catch {
    return false;
  }
  if (!isLocalDevHostname(hostname)) return false;
  const v = process.env.VERCEL_ENV;
  return v === "production" || v === "preview";
}

export function getMetadataBase(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit && !shouldIgnoreExplicitAppUrlInVercel(explicit)) {
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
