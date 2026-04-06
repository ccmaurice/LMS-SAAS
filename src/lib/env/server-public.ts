import { z } from "zod";

/**
 * Non-secret environment values used by server code for URLs and deployment context.
 * Do not add JWT secrets, database passwords, or API keys here.
 */

function emptyToUndefined(val: unknown) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  return val;
}

export const serverPublicEnvSchema = z.object({
  NODE_ENV: z.preprocess(emptyToUndefined, z.enum(["development", "production", "test"]).optional()),
  NEXT_PUBLIC_APP_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .url()
      .refine((s) => /^https?:\/\//i.test(s), {
        message: "NEXT_PUBLIC_APP_URL must use http:// or https://",
      })
      .optional(),
  ),
  VERCEL_ENV: z.preprocess(emptyToUndefined, z.string().optional()),
  VERCEL_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  VERCEL_PROJECT_PRODUCTION_URL: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type ServerPublicEnv = z.infer<typeof serverPublicEnvSchema>;

/** Parse from a given env bag (defaults to `process.env`). Throws on invalid shapes. */
export function parseServerPublicEnv(env: NodeJS.ProcessEnv = process.env): ServerPublicEnv {
  return serverPublicEnvSchema.parse({
    NODE_ENV: env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
    VERCEL_ENV: env.VERCEL_ENV,
    VERCEL_URL: env.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: env.VERCEL_PROJECT_PRODUCTION_URL,
  });
}

let cached: ServerPublicEnv | null = null;

/** Cached parse of `process.env` (call early in request handling or at first use). */
export function getServerPublicEnv(): ServerPublicEnv {
  if (cached == null) {
    cached = parseServerPublicEnv();
  }
  return cached;
}

/** Vitest: allow a fresh parse after mutating `process.env`. */
export function resetServerPublicEnvCacheForTests() {
  cached = null;
}
