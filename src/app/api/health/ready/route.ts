import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fail if the DB does not answer within this window (serverless / cold starts). */
const DB_CHECK_MS = 5000;

/**
 * Readiness probe: verifies PostgreSQL is reachable with the current DATABASE_URL.
 * Use for orchestrators and post-deploy checks. For cheap liveness-only pings, use GET /api/health.
 */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { ok: false, service: "saas-lms", database: "misconfigured", hint: "DATABASE_URL is not set" },
      { status: 503 },
    );
  }

  try {
    const { prisma } = await import("@/lib/db");
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), DB_CHECK_MS);
    });
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return NextResponse.json({ ok: true, service: "saas-lms", database: "up" });
  } catch {
    return NextResponse.json(
      { ok: false, service: "saas-lms", database: "unreachable" },
      { status: 503 },
    );
  }
}
