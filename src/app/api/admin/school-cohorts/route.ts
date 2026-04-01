import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { syncHomeroomAsInstructor } from "@/lib/school/cohort-access";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  gradeLabel: z.string().max(64).optional().nullable(),
  /** Optional stream / pathway label (e.g. sciences, IB) — common in secondary schools. */
  trackLabel: z.string().max(120).optional().nullable(),
  academicYearLabel: z.string().max(64).optional().nullable(),
  homeroomTeacherId: z.string().optional().nullable(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const cohorts = await prisma.schoolCohort.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true } },
      homeroomTeacher: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ cohorts });
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

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { academicYearLabel: true },
  });

  const homeroomTeacherId = parsed.data.homeroomTeacherId?.trim() || null;
  if (homeroomTeacherId) {
    const t = await prisma.user.findFirst({
      where: {
        id: homeroomTeacherId,
        organizationId: user.organizationId,
        role: { in: ["TEACHER", "ADMIN"] },
      },
    });
    if (!t) return NextResponse.json({ error: "Invalid homeroom teacher" }, { status: 400 });
  }

  const cohort = await prisma.schoolCohort.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name.trim(),
      gradeLabel: parsed.data.gradeLabel?.trim() || null,
      trackLabel: parsed.data.trackLabel?.trim() || null,
      academicYearLabel: parsed.data.academicYearLabel?.trim() || org?.academicYearLabel || "",
      homeroomTeacherId,
    },
    include: {
      _count: { select: { members: true } },
      homeroomTeacher: { select: { id: true, name: true, email: true } },
    },
  });

  if (homeroomTeacherId) {
    await syncHomeroomAsInstructor(cohort.id, homeroomTeacherId);
  }

  return NextResponse.json({ cohort });
}
