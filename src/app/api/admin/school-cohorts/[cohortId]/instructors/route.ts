import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const postSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => !!d.userId || !!d.email, { message: "userId or email required" });

export async function POST(req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const cohort = await prisma.schoolCohort.findFirst({
    where: { id: cohortId, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!cohort) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let resolvedId = parsed.data.userId;
  if (!resolvedId && parsed.data.email) {
    const byEmail = await prisma.user.findFirst({
      where: {
        organizationId: user.organizationId,
        email: parsed.data.email.toLowerCase().trim(),
        role: { in: ["TEACHER", "ADMIN"] },
      },
      select: { id: true },
    });
    resolvedId = byEmail?.id;
  }

  const u = resolvedId
    ? await prisma.user.findFirst({
        where: {
          id: resolvedId,
          organizationId: user.organizationId,
          role: { in: ["TEACHER", "ADMIN"] },
        },
        select: { id: true },
      })
    : null;
  if (!u) {
    return NextResponse.json({ error: "User must be teacher or admin in this school (check email)" }, { status: 400 });
  }

  await prisma.cohortInstructor.upsert({
    where: { cohortId_userId: { cohortId, userId: u.id } },
    create: { cohortId, userId: u.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const cohort = await prisma.schoolCohort.findFirst({
    where: { id: cohortId, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!cohort) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.cohortInstructor.deleteMany({ where: { cohortId, userId } });
  return NextResponse.json({ ok: true });
}
