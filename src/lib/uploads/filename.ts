const SAFE = /^[a-zA-Z0-9._-]+$/;

export function sanitizeDownloadBasename(name: string, fallback: string): string {
  const base = name.replace(/[/\\]/g, "").slice(0, 180).trim() || fallback;
  if (SAFE.test(base)) return base;
  return fallback;
}
