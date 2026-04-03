import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { signGoogleOAuthState } from "@/lib/auth/oauth-state";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";
import { prisma } from "@/lib/db";

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const ip = getRequestIp(request);
  const limited = checkRateLimit(`auth-google-start:${ip}`, 45, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.redirect(new URL("/login?error=too_many_requests", appOrigin()));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", appOrigin()));
  }

  const url = new URL(request.url);
  const rawSlug = url.searchParams.get("organizationSlug") ?? "";
  const slug = normalizeOrgSlug(rawSlug);
  if (!isValidOrgSlug(slug)) {
    return NextResponse.redirect(new URL("/login?error=google_invalid_org", appOrigin()));
  }

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    return NextResponse.redirect(new URL(`/login?org=${encodeURIComponent(slug)}&error=google_invalid_org`, appOrigin()));
  }

  const redirectTo = url.searchParams.get("redirect")?.trim() ?? "";
  const state = await signGoogleOAuthState(slug, redirectTo || undefined);

  const redirectUri = `${appOrigin()}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
