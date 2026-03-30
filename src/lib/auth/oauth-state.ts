import { SignJWT, jwtVerify } from "jose";

const KIND = "google_oauth_state";

function getKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signGoogleOAuthState(slug: string, redirect?: string | null) {
  return new SignJWT({
    kind: KIND,
    slug,
    redirect: redirect?.trim() || undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(getKey());
}

export async function verifyGoogleOAuthState(token: string): Promise<{ slug: string; redirect?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    if (payload.kind !== KIND) return null;
    const slug = payload.slug as string | undefined;
    if (!slug) return null;
    return { slug, redirect: payload.redirect as string | undefined };
  } catch {
    return null;
  }
}
