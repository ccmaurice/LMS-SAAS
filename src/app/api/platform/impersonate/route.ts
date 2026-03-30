import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE_SEC } from "@/lib/auth/constants";
import { signSessionToken } from "@/lib/auth/jwt";
import { getPlatformOperator } from "@/lib/platform/session";
import type { Role } from "@/generated/prisma/enums";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

async function pickUser(organizationId: string, userId?: string) {
  if (userId) {
    return prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: { organization: true },
    });
  }

  const roles: Role[] = ["ADMIN", "TEACHER", "STUDENT"];
  for (const role of roles) {
    const u = await prisma.user.findFirst({
      where: { organizationId, role },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    if (u) return u;
  }
  return null;
}

export async function POST(req: Request) {
  const op = await getPlatformOperator();
  if (!op) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const user = await pickUser(org.id, parsed.data.userId);
  if (!user) {
    return NextResponse.json({ error: "No user to impersonate in this organization" }, { status: 404 });
  }

  const token = await signSessionToken({
    sub: user.id,
    orgId: user.organizationId,
    orgSlug: user.organization.slug,
    role: user.role,
    platformImpersonation: true,
  });

  const res = NextResponse.json({
    organization: { id: org.id, name: org.name, slug: org.slug },
    user: { id: user.id, email: user.email, role: user.role },
  });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  });
  return res;
}
