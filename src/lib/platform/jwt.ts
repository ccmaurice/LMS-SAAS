import { SignJWT, jwtVerify } from "jose";
import { PLATFORM_AUTH_COOKIE_MAX_AGE_SEC } from "@/lib/auth/constants";

export type PlatformTokenPayload = { email: string };

function getKey() {
  const secret = process.env.PLATFORM_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PLATFORM_JWT_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signPlatformToken(email: string): Promise<string> {
  const key = getKey();
  return new SignJWT({ kind: "platform", email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${PLATFORM_AUTH_COOKIE_MAX_AGE_SEC}s`)
    .sign(key);
}

export async function verifyPlatformToken(token: string): Promise<PlatformTokenPayload | null> {
  try {
    const key = getKey();
    const { payload } = await jwtVerify(token, key);
    if (payload.kind !== "platform") return null;
    const email = payload.email;
    if (typeof email !== "string" || !email) return null;
    return { email };
  } catch {
    return null;
  }
}
