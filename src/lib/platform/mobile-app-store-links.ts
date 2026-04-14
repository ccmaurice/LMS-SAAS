/**
 * Public store URLs for native apps (optional). Set in `.env` / Vercel:
 * - `NEXT_PUBLIC_MOBILE_APP_IOS_URL` — App Store link (https://apps.apple.com/...).
 * - `NEXT_PUBLIC_MOBILE_APP_ANDROID_URL` — Play Store link (https://play.google.com/...).
 *
 * Until native apps ship, you can point these at the PWA URL so mobile users open the web app.
 */
export function getMobileAppStoreLinks(): { ios: string | null; android: string | null } {
  const ios = process.env.NEXT_PUBLIC_MOBILE_APP_IOS_URL?.trim() || null;
  const android = process.env.NEXT_PUBLIC_MOBILE_APP_ANDROID_URL?.trim() || null;
  return { ios, android };
}
