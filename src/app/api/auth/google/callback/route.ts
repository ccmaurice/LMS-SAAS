import { NextResponse } from "next/server";
import { exchangeGoogleCode, fetchGoogleUserInfo } from "@/lib/auth/google-oauth";
import { verifyGoogleOAuthState } from "@/lib/auth/oauth-state";
import { signSessionToken } from "@/lib/auth/jwt";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import { prisma } from "@/lib/db";

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function loginError(slug: string, error: string) {
  const u = new URL("/login", appOrigin());
  u.searchParams.set("org", slug);
  u.searchParams.set("error", error);
  return NextResponse.redirect(u);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError === "access_denied") {
    return NextResponse.redirect(new URL("/login?error=google_denied", appOrigin()));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=google_invalid_state", appOrigin()));
  }

  const parsed = await verifyGoogleOAuthState(state);
  if (!parsed) {
    return NextResponse.redirect(new URL("/login?error=google_invalid_state", appOrigin()));
  }

  const { slug, redirect: redirectTo } = parsed;
  const redirectUri = `${appOrigin()}/api/auth/google/callback`;

  let accessToken: string;
  try {
    accessToken = await exchangeGoogleCode(code, redirectUri);
  } catch {
    return loginError(slug, "google_token_failed");
  }

  let profile: Awaited<ReturnType<typeof fetchGoogleUserInfo>>;
  try {
    profile = await fetchGoogleUserInfo(accessToken);
  } catch {
    return loginError(slug, "google_profile_failed");
  }

  if (!profile.email || !profile.verified_email) {
    return loginError(slug, "google_email_unverified");
  }

  const email = profile.email.toLowerCase().trim();
  const googleSub = profile.id;

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    return loginError(slug, "google_invalid_org");
  }
  if (org.status === "PENDING") {
    return loginError(slug, "google_org_pending");
  }
  if (org.status === "REJECTED") {
    return loginError(slug, "google_org_rejected");
  }

  const byGoogle = await prisma.user.findFirst({
    where: { organizationId: org.id, googleSub },
    include: { organization: true },
  });

  let user = byGoogle;

  if (!user) {
    const byEmail = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId: org.id, email } },
      include: { organization: true },
    });

    if (!byEmail) {
      return loginError(slug, "google_no_account");
    }

    if (byEmail.googleSub && byEmail.googleSub !== googleSub) {
      return loginError(slug, "google_link_conflict");
    }

    user = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleSub,
        image: profile.picture ?? byEmail.image,
      },
      include: { organization: true },
    });
  }

  if (user.suspendedAt) {
    return loginError(slug, "suspended");
  }

  const token = await signSessionToken({
    sub: user.id,
    orgId: user.organizationId,
    orgSlug: user.organization.slug,
    role: user.role,
  });

  const target =
    redirectTo && redirectTo.startsWith("/o/")
      ? new URL(redirectTo, appOrigin())
      : new URL(`/o/${slug}/dashboard`, appOrigin());

  const res = NextResponse.redirect(target);
  applySessionCookie(res, token);
  return res;
}
