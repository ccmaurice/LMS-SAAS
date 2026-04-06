import { NextResponse } from "next/server";
import {
  fieldValidationErrorResponse,
  invalidJsonResponse,
  messageErrorResponse,
} from "@/lib/api/api-json";
import { checkRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE_SEC } from "@/lib/auth/constants";
import { signSessionToken } from "@/lib/auth/jwt";
import { acceptInviteBodySchema, acceptInviteSchoolUser } from "@/lib/invites/accept-invite";

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const limited = checkRateLimit(`invite-accept:${ip}`, 15, 60 * 60 * 1000);
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalidJsonResponse();
  }

  const parsed = acceptInviteBodySchema.safeParse(body);
  if (!parsed.success) {
    return fieldValidationErrorResponse(parsed.error);
  }

  const result = await acceptInviteSchoolUser(parsed.data);
  if (!result.ok) {
    return messageErrorResponse(result.error, result.status);
  }

  const sessionToken = await signSessionToken({
    sub: result.user.id,
    orgId: result.user.organizationId,
    orgSlug: result.user.organization.slug,
    role: result.user.role,
  });

  const res = NextResponse.json({
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      organization: { slug: result.user.organization.slug, name: result.user.organization.name },
    },
  });
  res.cookies.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  });
  return res;
}
