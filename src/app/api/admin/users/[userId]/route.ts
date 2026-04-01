import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import type { Role } from "@/generated/prisma/enums";

const patchSchema = z.object({
  name: z.union([z.string().max(120), z.literal("")]).optional(),
  role: z.enum(["TEACHER", "STUDENT", "PARENT"]).optional(),
  suspended: z.boolean().optional(),
});

function isFkDeleteError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2003";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  if (userId === user.id) {
    return NextResponse.json({ error: "You cannot change your own account here." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: user.organizationId },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "School admins cannot modify other admins here." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data: { name?: string | null; role?: Role; suspendedAt?: Date | null } = {};

  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name === "" ? null : parsed.data.name.trim() || null;
  }
  if (parsed.data.role !== undefined) {
    data.role = parsed.data.role;
  }
  if (parsed.data.suspended !== undefined) {
    data.suspendedAt = parsed.data.suspended ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, role: true, suspendedAt: true },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  if (userId === user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: user.organizationId },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "School admins cannot remove other admins." }, { status: 403 });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (e) {
    if (isFkDeleteError(e)) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this member while they still own courses or assessments. Reassign or delete those first, or suspend the account instead.",
        },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
