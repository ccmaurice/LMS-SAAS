import { NextResponse } from "next/server";
import { PLATFORM_AUTH_COOKIE } from "@/lib/auth/constants";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PLATFORM_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
