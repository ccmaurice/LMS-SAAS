import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";

const bodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

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
    where: { id: orgId },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (org.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending schools can be approved or rejected." }, { status: 400 });
  }

  if (parsed.data.decision === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: orgId },
        data: { status: "ACTIVE" },
      });
      const admins = await tx.user.findMany({
        where: { organizationId: orgId, role: "ADMIN" },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((u) => ({
            userId: u.id,
            title: "School approved",
            body: `${org.name} is now active. Sign in with your school URL to get started.`,
            link: `/o/${org.slug}/dashboard`,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true, status: "ACTIVE" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: orgId },
      data: { status: "REJECTED" },
    });
    const admins = await tx.user.findMany({
      where: { organizationId: orgId, role: "ADMIN" },
      select: { id: true },
    });
    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((u) => ({
          userId: u.id,
          title: "School not approved",
          body: `${org.name} was not approved on the platform. Contact support if you need help.`,
        })),
      });
    }
  });

  return NextResponse.json({ ok: true, status: "REJECTED" });
}
