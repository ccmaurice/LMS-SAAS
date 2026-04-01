import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(32).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const rows = await prisma.facultyDivision.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { departments: true } } },
  });
  return NextResponse.json({ divisions: rows });
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

  const row = await prisma.facultyDivision.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name.trim(),
      code: parsed.data.code?.trim() || null,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  return NextResponse.json({ division: row });
}
