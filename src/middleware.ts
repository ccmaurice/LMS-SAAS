import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, PLATFORM_AUTH_COOKIE } from "@/lib/auth/constants";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login" || pathname.startsWith("/platform/login/")) {
      return NextResponse.next();
    }

    const secret = process.env.PLATFORM_JWT_SECRET ?? "";
    if (!secret || secret.length < 16) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const key = new TextEncoder().encode(secret);
    const token = request.cookies.get(PLATFORM_AUTH_COOKIE)?.value;
    if (!token) {
      return redirectToPlatformLogin(request, pathname);
    }

    try {
      const { payload } = await jwtVerify(token, key);
      if (payload.kind !== "platform") {
        return redirectToPlatformLogin(request, pathname);
      }
      return NextResponse.next();
    } catch {
      return redirectToPlatformLogin(request, pathname);
    }
  }

  const match = pathname.match(/^\/o\/([^/]+)/);
  if (!match) return NextResponse.next();

  const slug = match[1];
  const secret = process.env.JWT_SECRET ?? "";
  const key = new TextEncoder().encode(secret);

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(request, pathname, slug);
  }

  try {
    const { payload } = await jwtVerify(token, key);
    const orgSlug = payload.orgSlug as string | undefined;
    if (!orgSlug || orgSlug !== slug) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, pathname, slug);
  }
}

function redirectToPlatformLogin(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/platform/login";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

function redirectToLogin(request: NextRequest, pathname: string, slug: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirect", pathname);
  url.searchParams.set("org", slug);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/o/:path*", "/platform/:path*"],
};
