import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

export async function DELETE(_req: Request, ctx: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const invite = await prisma.userInvite.findFirst({
    where: { id: inviteId, organizationId: user.organizationId },
  });
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.userInvite.delete({ where: { id: inviteId } });
  return NextResponse.json({ ok: true });
}
