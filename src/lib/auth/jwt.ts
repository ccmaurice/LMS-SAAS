import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";
import { AUTH_COOKIE_MAX_AGE_SEC } from "./constants";

export type SessionPayload = {
  sub: string;
  orgId: string;
  orgSlug: string;
  role: Role;
  /** Set when platform operator uses impersonation — allows access before org approval. */
  platformImpersonation?: boolean;
};

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const key = getSecretKey();
  const claims: Record<string, unknown> = {
    orgId: payload.orgId,
    orgSlug: payload.orgSlug,
    role: payload.role,
  };
  if (payload.platformImpersonation) {
    claims.platformImpersonation = true;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_COOKIE_MAX_AGE_SEC}s`)
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key);
    const sub = payload.sub;
    const orgId = payload.orgId as string | undefined;
    const orgSlug = payload.orgSlug as string | undefined;
    const role = payload.role as Role | undefined;
    if (!sub || !orgId || !orgSlug || !role) return null;
    const platformImpersonation = payload.platformImpersonation === true;
    return { sub, orgId, orgSlug, role, platformImpersonation };
  } catch {
    return null;
  }
}
