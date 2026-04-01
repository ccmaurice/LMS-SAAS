import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const patchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  isCurrent: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ termId: string }> }) {
  const { termId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, organizationId: user.organizationId },
  });
  if (!term) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isCurrent === true) {
      await tx.academicTerm.updateMany({
        where: { organizationId: user.organizationId },
        data: { isCurrent: false },
      });
    }
    await tx.academicTerm.update({
      where: { id: termId },
      data: {
        ...(parsed.data.label !== undefined && { label: parsed.data.label.trim() }),
        ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
        ...(parsed.data.startDate !== undefined && {
          startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        }),
        ...(parsed.data.endDate !== undefined && {
          endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        }),
        ...(parsed.data.isCurrent !== undefined && { isCurrent: parsed.data.isCurrent }),
      },
    });
  });

  const updated = await prisma.academicTerm.findUnique({ where: { id: termId } });
  return NextResponse.json({ term: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ termId: string }> }) {
  const { termId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, organizationId: user.organizationId },
  });
  if (!term) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.academicTerm.delete({ where: { id: termId } });
  return NextResponse.json({ ok: true });
}
