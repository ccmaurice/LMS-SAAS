import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const createSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  isCurrent: z.boolean().optional(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const terms = await prisma.academicTerm.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ terms });
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

  const { code, label, sortOrder, startDate, endDate, isCurrent } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (isCurrent) {
      await tx.academicTerm.updateMany({
        where: { organizationId: user.organizationId },
        data: { isCurrent: false },
      });
    }
    await tx.academicTerm.create({
      data: {
        organizationId: user.organizationId,
        code: code.trim(),
        label: label.trim(),
        sortOrder: sortOrder ?? 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isCurrent: isCurrent ?? false,
      },
    });
  });

  const terms = await prisma.academicTerm.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ terms });
}
