import { describe, expect, it } from "vitest";
import { parseServerPublicEnv, serverPublicEnvSchema } from "@/lib/env/server-public";

describe("parseServerPublicEnv", () => {
  it("accepts empty optional vars", () => {
    const env = parseServerPublicEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: undefined,
      VERCEL_ENV: undefined,
      VERCEL_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBeUndefined();
  });

  it("treats blank NEXT_PUBLIC_APP_URL as undefined", () => {
    const env = parseServerPublicEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "  ",
      VERCEL_ENV: undefined,
      VERCEL_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBeUndefined();
  });

  it("accepts http localhost URL", () => {
    const env = parseServerPublicEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      VERCEL_ENV: undefined,
      VERCEL_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("rejects non-http(s) URL scheme", () => {
    expect(() =>
      serverPublicEnvSchema.parse({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "ftp://example.com",
        VERCEL_ENV: undefined,
        VERCEL_URL: undefined,
        VERCEL_PROJECT_PRODUCTION_URL: undefined,
      }),
    ).toThrow(/http/);
  });

  it("rejects malformed URL", () => {
    expect(() =>
      serverPublicEnvSchema.parse({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "not a url",
        VERCEL_ENV: undefined,
        VERCEL_URL: undefined,
        VERCEL_PROJECT_PRODUCTION_URL: undefined,
      }),
    ).toThrow();
  });
});
