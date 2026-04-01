import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAuthDatabaseError } from "@/lib/prisma-errors";
import { signSessionToken } from "@/lib/auth/jwt";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import { verifyPassword } from "@/lib/auth/password";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1),
});

function zodIssuesToMessage(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`).join(" ");
}

export async function POST(req: Request) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: zodIssuesToMessage(parsed.error) }, { status: 400 });
    }

    const slug = normalizeOrgSlug(parsed.data.organizationSlug);
    if (!isValidOrgSlug(slug)) {
      return NextResponse.json({ error: "Invalid organization URL." }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      return NextResponse.json(
        {
          error:
            "No school found for that slug. Run `npm run db:seed` (or `db:bootstrap`) for demo-school, or use the slug from your invite.",
        },
        { status: 401 },
      );
    }

    if (org.status === "PENDING") {
      return NextResponse.json(
        { error: "This school is still awaiting platform approval. You cannot sign in yet." },
        { status: 403 },
      );
    }
    if (org.status === "REJECTED") {
      return NextResponse.json(
        {
          error:
            "This school registration was not approved. Contact the platform operator if you believe this is a mistake.",
        },
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
      return NextResponse.json(
        {
          error:
            "No password sign-in for that email in this school. Check the email, use the slug for the school that invited you, or run `npm run db:seed` for admin@test.com.",
        },
        { status: 401 },
      );
    }

    const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ error: "Wrong password for that email." }, { status: 401 });
    }

    if (user.suspendedAt) {
      return NextResponse.json(
        { error: "This account has been suspended. Contact your school administrator." },
        { status: 403 },
      );
    }

    let token: string;
    try {
      token = await signSessionToken({
        sub: user.id,
        orgId: user.organizationId,
        orgSlug: user.organization.slug,
        role: user.role,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Session signing failed.";
      console.error("[auth/login]", e);
      return NextResponse.json(
        {
          error: msg.includes("JWT_SECRET")
            ? "Server misconfiguration: set JWT_SECRET in .env (at least 16 characters), then restart the dev server."
            : "Could not create a session. Check server logs.",
        },
        { status: 500 },
      );
    }

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
  } catch (e) {
    console.error("[auth/login] unexpected", e);
    const dbHint = resolveAuthDatabaseError(e);
    if (dbHint) {
      return NextResponse.json({ error: dbHint.error }, { status: dbHint.status });
    }
    const devDetail =
      process.env.NODE_ENV === "development" && e instanceof Error && e.message
        ? ` ${e.message}`
        : "";
    return NextResponse.json(
      {
        error: `Sign-in failed unexpectedly.${devDetail} Check the dev server terminal for details.`,
      },
      { status: 500 },
    );
  }
}
