import { NextResponse } from "next/server";

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

/** Clears fixed-window state; used by Vitest only. */
export function clearRateLimitBucketsForTests() {
  buckets.clear();
}

function pruneStale(now: number, windowMs: number) {
  if (buckets.size < 5000 || Math.random() > 0.02) return;
  const cutoff = now - windowMs * 2;
  for (const [k, b] of buckets) {
    if (b.windowStart < cutoff) buckets.delete(k);
  }
}

/**
 * Best-effort client IP for rate limiting. Behind a trusted reverse proxy, configure it to set
 * X-Forwarded-For (first hop = client). Untrusted clients can spoof this header if the proxy does not overwrite it.
 */
export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  return "unknown";
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Fixed-window limiter (in-memory, per server instance). Use for brute-force and signup abuse mitigation.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneStale(now, windowMs);

  let b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    b = { windowStart: now, count: 0 };
    buckets.set(key, b);
  }

  b.count += 1;
  if (b.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((b.windowStart + windowMs - now) / 1000));
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests. Please wait and try again." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      ),
    };
  }
  return { ok: true };
}
