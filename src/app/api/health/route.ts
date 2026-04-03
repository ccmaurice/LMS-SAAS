import { NextResponse } from "next/server";

/**
 * Liveness probe: no database or external calls. Suitable for frequent pings.
 * For DB readiness (deploy / load balancer), use GET /api/health/ready.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "saas-lms" });
}
