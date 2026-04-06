import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clearRateLimitBucketsForTests, getRequestIp } from "@/lib/api/rate-limit";

describe("getRequestIp", () => {
  it("uses first address from X-Forwarded-For", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": " 203.0.113.1 , 10.0.0.1" },
    });
    expect(getRequestIp(req)).toBe("203.0.113.1");
  });

  it("falls back to X-Real-IP", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    expect(getRequestIp(req)).toBe("198.51.100.2");
  });

  it("falls back to CF-Connecting-IP", () => {
    const req = new Request("http://localhost/", {
      headers: { "cf-connecting-ip": "192.0.2.3" },
    });
    expect(getRequestIp(req)).toBe("192.0.2.3");
  });

  it("returns unknown when no proxy headers", () => {
    expect(getRequestIp(new Request("http://localhost/"))).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearRateLimitBucketsForTests();
    vi.useRealTimers();
  });

  afterEach(() => {
    clearRateLimitBucketsForTests();
    vi.useRealTimers();
  });

  it("allows up to max requests in a window", () => {
    expect(checkRateLimit("login:ip-a", 3, 60_000).ok).toBe(true);
    expect(checkRateLimit("login:ip-a", 3, 60_000).ok).toBe(true);
    expect(checkRateLimit("login:ip-a", 3, 60_000).ok).toBe(true);
  });

  it("blocks when count exceeds max with 429 and Retry-After", () => {
    for (let i = 0; i < 2; i++) expect(checkRateLimit("auth:x", 2, 60_000).ok).toBe(true);
    const blocked = checkRateLimit("auth:x", 2, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.response.status).toBe(429);
      expect(blocked.response.headers.get("Retry-After")).toBeTruthy();
    }
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < 5; i++) expect(checkRateLimit("tenant-a", 5, 60_000).ok).toBe(true);
    expect(checkRateLimit("tenant-b", 5, 60_000).ok).toBe(true);
  });

  it("opens a new window after windowMs elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    expect(checkRateLimit("window-key", 1, 10_000).ok).toBe(true);
    const blocked = checkRateLimit("window-key", 1, 10_000);
    expect(blocked.ok).toBe(false);

    vi.setSystemTime(new Date("2026-03-01T12:00:11.000Z"));
    expect(checkRateLimit("window-key", 1, 10_000).ok).toBe(true);
  });
});
