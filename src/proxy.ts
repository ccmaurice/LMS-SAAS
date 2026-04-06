import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, PLATFORM_AUTH_COOKIE } from "@/lib/auth/constants";

function attachRequestTelemetry(request: NextRequest, response: NextResponse) {
  const requestId = crypto.randomUUID();
  response.headers.set("X-Request-Id", requestId);
  if (process.env.ENABLE_REQUEST_LOG === "true") {
    const pathname = request.nextUrl.pathname;
    const payload: Record<string, unknown> = {
      level: "info",
      msg: "edge_request",
      requestId,
      method: request.method,
      path: pathname,
    };
    const orgMatch = pathname.match(/^\/o\/([^/]+)/);
    if (orgMatch) payload.orgSlug = orgMatch[1];
    if (pathname.startsWith("/platform")) payload.area = "platform";
    console.info(JSON.stringify(payload));
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login" || pathname.startsWith("/platform/login/")) {
      return attachRequestTelemetry(request, NextResponse.next());
    }

    const secret = process.env.PLATFORM_JWT_SECRET ?? "";
    if (!secret || secret.length < 16) {
      return attachRequestTelemetry(
        request,
        NextResponse.redirect(new URL("/", request.url)),
      );
    }

    const key = new TextEncoder().encode(secret);
    const token = request.cookies.get(PLATFORM_AUTH_COOKIE)?.value;
    if (!token) {
      return attachRequestTelemetry(request, redirectToPlatformLogin(request, pathname));
    }

    try {
      const { payload } = await jwtVerify(token, key);
      if (payload.kind !== "platform") {
        return attachRequestTelemetry(request, redirectToPlatformLogin(request, pathname));
      }
      return attachRequestTelemetry(request, NextResponse.next());
    } catch {
      return attachRequestTelemetry(request, redirectToPlatformLogin(request, pathname));
    }
  }

  const match = pathname.match(/^\/o\/([^/]+)/);
  if (!match) return attachRequestTelemetry(request, NextResponse.next());

  const slug = match[1];
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret || secret.length < 16) {
    return attachRequestTelemetry(request, NextResponse.redirect(new URL("/", request.url)));
  }
  const key = new TextEncoder().encode(secret);

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return attachRequestTelemetry(request, redirectToLogin(request, pathname, slug));
  }

  try {
    const { payload } = await jwtVerify(token, key);
    const orgSlug = payload.orgSlug as string | undefined;
    if (!orgSlug || orgSlug !== slug) {
      return attachRequestTelemetry(request, NextResponse.redirect(new URL("/", request.url)));
    }
    return attachRequestTelemetry(request, NextResponse.next());
  } catch {
    return attachRequestTelemetry(request, redirectToLogin(request, pathname, slug));
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
