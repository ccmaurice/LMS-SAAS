import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(32).optional().nullable(),
  facultyDivisionId: z.string().optional().nullable(),
  chairUserId: z.string().optional().nullable(),
  chairEmail: z.string().email().optional(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const departments = await prisma.academicDepartment.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    include: {
      facultyDivision: { select: { id: true, name: true } },
      chair: { select: { id: true, name: true, email: true } },
      _count: { select: { instructors: true, studentAffiliations: true } },
    },
  });
  return NextResponse.json({ departments });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const facultyDivisionId = parsed.data.facultyDivisionId?.trim() || null;
  if (facultyDivisionId) {
    const div = await prisma.facultyDivision.findFirst({
      where: { id: facultyDivisionId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!div) return NextResponse.json({ error: "Invalid faculty division" }, { status: 400 });
  }

  let chairUserId = parsed.data.chairUserId?.trim() || null;
  if (!chairUserId && parsed.data.chairEmail) {
    const byEmail = await prisma.user.findFirst({
      where: {
        organizationId: user.organizationId,
        email: parsed.data.chairEmail.toLowerCase().trim(),
        role: { in: ["TEACHER", "ADMIN"] },
      },
      select: { id: true },
    });
    chairUserId = byEmail?.id ?? null;
  }
  if (chairUserId) {
    const u = await prisma.user.findFirst({
      where: {
        id: chairUserId,
        organizationId: user.organizationId,
        role: { in: ["TEACHER", "ADMIN"] },
      },
      select: { id: true },
    });
    if (!u) return NextResponse.json({ error: "Chair must be a teacher or admin in this school" }, { status: 400 });
  }

  const dept = await prisma.academicDepartment.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name.trim(),
      code: parsed.data.code?.trim() || null,
      facultyDivisionId,
      chairUserId,
    },
  });

  if (chairUserId) {
    await prisma.departmentInstructor.upsert({
      where: { departmentId_userId: { departmentId: dept.id, userId: chairUserId } },
      create: { departmentId: dept.id, userId: chairUserId },
      update: {},
    });
  }

  return NextResponse.json({ department: dept });
}
