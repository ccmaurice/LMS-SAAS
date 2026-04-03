/**
 * Base URL for Next.js metadata (favicons, OG images). Set `NEXT_PUBLIC_APP_URL` in production.
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
