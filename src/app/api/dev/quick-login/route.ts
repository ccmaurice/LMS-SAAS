import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSessionToken } from "@/lib/auth/jwt";
import { applySessionCookie } from "@/lib/auth/session-cookie";

/**
 * Development only: one GET sets the session cookie for the seeded demo admin.
 * Open: /api/dev/quick-login
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const org = await prisma.organization.findUnique({ where: { slug: "demo-school" } });
  if (!org) {
    return NextResponse.json(
      { error: "No demo-school org. Run: npm run db:seed" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email: "admin@test.com" } },
    include: { organization: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Demo admin missing. Run: npm run db:seed" },
      { status: 400 },
    );
  }

  const token = await signSessionToken({
    sub: user.id,
    orgId: user.organizationId,
    orgSlug: user.organization.slug,
    role: user.role,
  });

  const origin = new URL(request.url).origin;
  const res = NextResponse.redirect(`${origin}/o/${org.slug}/dashboard`);
  applySessionCookie(res, token);
  return res;
}
