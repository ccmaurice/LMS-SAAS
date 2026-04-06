import { NextResponse } from "next/server";
import { invalidJsonResponse, messageErrorResponse } from "@/lib/api/api-json";
import { checkRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { resolveAuthDatabaseError } from "@/lib/prisma-errors";
import { signSessionToken } from "@/lib/auth/jwt";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import {
  credentialLogin,
  loginCredentialsBodySchema,
  zodIssuesToLoginMessage,
} from "@/lib/auth/login-credentials";

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req);
    const limited = checkRateLimit(`auth-login:${ip}`, 30, 15 * 60 * 1000);
    if (!limited.ok) return limited.response;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return invalidJsonResponse();
    }

    const parsed = loginCredentialsBodySchema.safeParse(json);
    if (!parsed.success) {
      return messageErrorResponse(zodIssuesToLoginMessage(parsed.error), 400);
    }

    const result = await credentialLogin(parsed.data);
    if (!result.ok) {
      return messageErrorResponse(result.error, result.status);
    }

    let token: string;
    try {
      token = await signSessionToken({
        sub: result.user.id,
        orgId: result.user.organizationId,
        orgSlug: result.user.organization.slug,
        role: result.user.role,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Session signing failed.";
      console.error("[auth/login]", e);
      return messageErrorResponse(
        msg.includes("JWT_SECRET")
          ? "Server misconfiguration: set JWT_SECRET in .env (at least 16 characters), then restart the dev server."
          : "Could not create a session. Check server logs.",
        500,
      );
    }

    const res = NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organization: result.user.organization,
      },
    });
    applySessionCookie(res, token);
    return res;
  } catch (e) {
    console.error("[auth/login] unexpected", e);
    const dbHint = resolveAuthDatabaseError(e);
    if (dbHint) {
      return messageErrorResponse(dbHint.error, dbHint.status);
    }
    const devDetail =
      process.env.NODE_ENV === "development" && e instanceof Error && e.message
        ? ` ${e.message}`
        : "";
    return messageErrorResponse(
      `Sign-in failed unexpectedly.${devDetail} Check the dev server terminal for details.`,
      500,
    );
  }
}
