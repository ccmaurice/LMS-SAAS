import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signSessionToken } from "@/lib/auth/jwt";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import { verifyPassword } from "@/lib/auth/password";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1),
});

export async function POST(req: Request) {
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

  const slug = normalizeOrgSlug(parsed.data.organizationSlug);
  if (!isValidOrgSlug(slug)) {
    return NextResponse.json({ error: "Invalid organization URL." }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    return NextResponse.json({ error: "Invalid email, password, or organization." }, { status: 401 });
  }

  if (org.status === "PENDING") {
    return NextResponse.json(
      { error: "This school is still awaiting platform approval. You cannot sign in yet." },
      { status: 403 },
    );
  }
  if (org.status === "REJECTED") {
    return NextResponse.json(
      { error: "This school registration was not approved. Contact the platform operator if you believe this is a mistake." },
      { status: 403 },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: parsed.data.email.toLowerCase().trim(),
      },
    },
    include: { organization: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Invalid email, password, or organization." }, { status: 401 });
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email, password, or organization." }, { status: 401 });
  }

  if (user.suspendedAt) {
    return NextResponse.json({ error: "This account has been suspended. Contact your school administrator." }, { status: 403 });
  }

  const token = await signSessionToken({
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
      organization: { id: user.organization.id, name: user.organization.name, slug: user.organization.slug },
    },
  });
  applySessionCookie(res, token);
  return res;
}
