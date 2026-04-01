import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gradeLabel: z.string().max(64).optional().nullable(),
  trackLabel: z.string().max(120).optional().nullable(),
  academicYearLabel: z.string().max(64).optional().nullable(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const cohort = await prisma.schoolCohort.findFirst({
    where: { id: cohortId, organizationId: user.organizationId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      homeroomTeacher: { select: { id: true, name: true, email: true } },
    },
  });
  if (!cohort) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ cohort });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const existing = await prisma.schoolCohort.findFirst({
    where: { id: cohortId, organizationId: user.organizationId },
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

  const updated = await prisma.schoolCohort.update({
    where: { id: cohortId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
      ...(parsed.data.gradeLabel !== undefined && { gradeLabel: parsed.data.gradeLabel?.trim() || null }),
      ...(parsed.data.trackLabel !== undefined && { trackLabel: parsed.data.trackLabel?.trim() || null }),
      ...(parsed.data.academicYearLabel !== undefined && {
        academicYearLabel: parsed.data.academicYearLabel?.trim() || "",
      }),
    },
    include: {
      _count: { select: { members: true } },
      homeroomTeacher: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ cohort: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const cohort = await prisma.schoolCohort.findFirst({
    where: { id: cohortId, organizationId: user.organizationId },
  });
  if (!cohort) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.schoolCohort.delete({ where: { id: cohortId } });
  return NextResponse.json({ ok: true });
}
