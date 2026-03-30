import type { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE_SEC } from "./constants";

export function applySessionCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  });
}
