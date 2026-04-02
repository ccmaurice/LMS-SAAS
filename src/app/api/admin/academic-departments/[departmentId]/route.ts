import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(32).optional().nullable(),
  facultyDivisionId: z.string().nullable().optional(),
  chairUserId: z.string().nullable().optional(),
  /** Set chair by school email, or pass "" to clear the chair. */
  chairEmail: z.union([z.string().email(), z.literal("")]).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const dept = await prisma.academicDepartment.findFirst({
    where: { id: departmentId, organizationId: user.organizationId },
    include: {
      facultyDivision: { select: { id: true, name: true } },
      chair: { select: { id: true, name: true, email: true } },
      instructors: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      studentAffiliations: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
    },
  });
  if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ department: dept });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const existing = await prisma.academicDepartment.findFirst({
    where: { id: departmentId, organizationId: user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const facultyDivisionId = parsed.data.facultyDivisionId;
  if (facultyDivisionId !== undefined && facultyDivisionId !== null) {
    const div = await prisma.facultyDivision.findFirst({
      where: { id: facultyDivisionId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!div) return NextResponse.json({ error: "Invalid faculty division" }, { status: 400 });
  }

  let chairUserId: string | null | undefined = undefined;
  if (parsed.data.chairUserId !== undefined) {
    chairUserId = parsed.data.chairUserId;
  }
  if (parsed.data.chairEmail !== undefined) {
    if (parsed.data.chairEmail === "") {
      chairUserId = null;
    } else {
      const em = parsed.data.chairEmail.toLowerCase().trim();
      const byEmail = await prisma.user.findFirst({
        where: {
          organizationId: user.organizationId,
          email: em,
          role: { in: ["TEACHER", "ADMIN"] },
        },
        select: { id: true },
      });
      if (!byEmail) {
        return NextResponse.json({ error: "No teacher or admin with that email" }, { status: 400 });
      }
      chairUserId = byEmail.id;
    }
  }
  if (chairUserId !== undefined && chairUserId !== null) {
    const u = await prisma.user.findFirst({
      where: {
        id: chairUserId,
        organizationId: user.organizationId,
        role: { in: ["TEACHER", "ADMIN"] },
      },
      select: { id: true },
    });
    if (!u) return NextResponse.json({ error: "Invalid chair" }, { status: 400 });
  }

  const updated = await prisma.academicDepartment.update({
    where: { id: departmentId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
      ...(parsed.data.code !== undefined && { code: parsed.data.code?.trim() || null }),
      ...(facultyDivisionId !== undefined && { facultyDivisionId }),
      ...(chairUserId !== undefined && { chairUserId }),
    },
  });

  if (chairUserId !== undefined && chairUserId !== null) {
    await prisma.departmentInstructor.upsert({
      where: { departmentId_userId: { departmentId, userId: chairUserId } },
      create: { departmentId, userId: chairUserId },
      update: {},
    });
  }

  return NextResponse.json({ department: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const existing = await prisma.academicDepartment.findFirst({
    where: { id: departmentId, organizationId: user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.academicDepartment.delete({ where: { id: departmentId } });
  return NextResponse.json({ ok: true });
}
