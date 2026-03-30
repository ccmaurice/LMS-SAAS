import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE } from "./constants";
import type { SessionPayload } from "./jwt";
import { verifySessionToken } from "./jwt";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { organization: true },
  });
  if (!user) return null;
  if (user.organization.slug !== session.orgSlug) return null;
  if (user.suspendedAt) return null;
  if (user.organization.status !== "ACTIVE" && !session.platformImpersonation) {
    return null;
  }
  return user;
}
