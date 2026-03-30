import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PLATFORM_AUTH_COOKIE,
  PLATFORM_AUTH_COOKIE_MAX_AGE_SEC,
} from "@/lib/auth/constants";
import { signPlatformToken } from "@/lib/platform/jwt";

/** Zod's `.email()` rejects valid dev IDs like `platform@local` (no dot in domain). */
const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(320)
    .regex(/^[^\s@]+@[^\s@]+$/, "Invalid email"),
  password: z.string().min(1),
});

function timingSafeStringEq(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase().replace(/\r$/, "");
  const adminPassword = (process.env.PLATFORM_ADMIN_PASSWORD ?? "").trim().replace(/\r$/, "");

  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: "Platform operator is not configured." }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const okEmail = timingSafeStringEq(email, adminEmail);
  const okPass = timingSafeStringEq(parsed.data.password, adminPassword);
  if (!okEmail || !okPass) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  let token: string;
  try {
    token = await signPlatformToken(email);
  } catch {
    return NextResponse.json({ error: "Platform auth is misconfigured (JWT secret)." }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(PLATFORM_AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLATFORM_AUTH_COOKIE_MAX_AGE_SEC,
  });
  return res;
}
