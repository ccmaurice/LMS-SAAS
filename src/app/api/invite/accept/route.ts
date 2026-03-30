import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE_SEC } from "@/lib/auth/constants";
import { signSessionToken } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";

const bodySchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional(),
});

export async function POST(req: Request) {
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

  const { token, password, name } = parsed.data;

  const invite = await prisma.userInvite.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite || invite.expiresAt <= new Date()) {
    return NextResponse.json({ error: "This invite is invalid or has expired." }, { status: 400 });
  }

  if (invite.organization.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This school is not active yet (pending approval or inactive). Invites cannot be accepted." },
      { status: 403 },
    );
  }

  const email = invite.email.toLowerCase().trim();
  const taken = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: invite.organizationId, email } },
  });
  if (taken) {
    return NextResponse.json({ error: "This email is already registered in this organization." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    await tx.userInvite.delete({ where: { id: invite.id } });
    return tx.user.create({
      data: {
        email,
        passwordHash,
        name: name?.trim() || null,
        role: invite.role,
        organizationId: invite.organizationId,
      },
      include: { organization: true },
    });
  });

  const sessionToken = await signSessionToken({
    sub: user.id,
    orgId: user.organizationId,
    orgSlug: user.organization.slug,
    role: user.role,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: { slug: user.organization.slug, name: user.organization.name },
    },
  });
  res.cookies.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  });
  return res;
}
