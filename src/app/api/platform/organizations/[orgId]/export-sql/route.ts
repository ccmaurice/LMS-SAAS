import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";
import { exportOrganizationCoreSql } from "@/lib/platform/org-sql-export";

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const sql = await exportOrganizationCoreSql(orgId);
  if (sql == null) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const safeSlug = org.slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 48) || "org";
  const filename = `org-${safeSlug}-core.sql`;

  return new NextResponse(sql, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
