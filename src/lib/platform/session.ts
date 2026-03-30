import { cookies } from "next/headers";
import { PLATFORM_AUTH_COOKIE } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { verifyPlatformToken } from "@/lib/platform/jwt";

export type PlatformOperator = {
  email: string;
  image: string | null;
};

export async function getPlatformOperator(): Promise<PlatformOperator | null> {
  const jar = await cookies();
  const token = jar.get(PLATFORM_AUTH_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyPlatformToken(token);
  if (!payload) return null;

  const profile = await prisma.platformProfile.findUnique({
    where: { email: payload.email },
    select: { image: true },
  });

  return { email: payload.email, image: profile?.image ?? null };
}
