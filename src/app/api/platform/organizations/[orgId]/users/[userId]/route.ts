import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";

const patchSchema = z
  .object({
    suspended: z.boolean().optional(),
    role: z.enum(["ADMIN", "TEACHER", "STUDENT"]).optional(),
    name: z.union([z.string().max(200), z.literal("")]).optional(),
  })
  .refine((d) => d.suspended !== undefined || d.role !== undefined || d.name !== undefined, {
    message: "No changes",
  });

function isFkDeleteError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2003";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ orgId: string; userId: string }> }) {
  const { orgId, userId } = await ctx.params;
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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

  if (parsed.data.role !== undefined && parsed.data.role !== target.role) {
    if (target.role === "ADMIN" && parsed.data.role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { organizationId: orgId, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot change role of the last school admin. Promote another admin first." },
          { status: 400 },
        );
      }
    }
  }

  const data: {
    suspendedAt?: Date | null;
    role?: "ADMIN" | "TEACHER" | "STUDENT";
    name?: string | null;
  } = {};

  if (parsed.data.suspended !== undefined) {
    data.suspendedAt = parsed.data.suspended ? new Date() : null;
  }
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name.trim() === "" ? null : parsed.data.name.trim();
  }
  if (parsed.data.role !== undefined) {
    data.role = parsed.data.role;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, role: true, suspendedAt: true },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ orgId: string; userId: string }> }) {
  const { orgId, userId } = await ctx.params;
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { organizationId: orgId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last school admin. Promote another admin first." },
        { status: 400 },
      );
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (e) {
    if (isFkDeleteError(e)) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this user while related courses, assessments, or other records still depend on them. Reassign or remove those first, or suspend the account.",
        },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
