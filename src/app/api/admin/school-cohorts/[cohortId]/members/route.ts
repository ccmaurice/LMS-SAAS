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

  let studentUserId = parsed.data.userId;
  if (!studentUserId && parsed.data.email) {
    const u = await prisma.user.findFirst({
      where: {
        organizationId: user.organizationId,
        email: parsed.data.email.toLowerCase().trim(),
        role: "STUDENT",
      },
    });
    studentUserId = u?.id;
  }

  const student = studentUserId
    ? await prisma.user.findFirst({
        where: {
          id: studentUserId,
          organizationId: user.organizationId,
          role: "STUDENT",
        },
      })
    : null;
  if (!student) return NextResponse.json({ error: "Student not found in this school" }, { status: 400 });

  await prisma.cohortMembership.upsert({
    where: {
      cohortId_userId: { cohortId, userId: student.id },
    },
    create: { cohortId, userId: student.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const cohort = await prisma.schoolCohort.findFirst({
    where: { id: cohortId, organizationId: user.organizationId },
  });
  if (!cohort) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.cohortMembership.deleteMany({
    where: { cohortId, userId },
  });

  return NextResponse.json({ ok: true });
}
