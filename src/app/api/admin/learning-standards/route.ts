import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const postSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  description: z.string().max(10_000).optional().nullable(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const rows = await prisma.learningStandard.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { code: "asc" },
    select: { id: true, code: true, title: true, description: true },
  });

  return NextResponse.json({ standards: rows });
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
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const row = await prisma.learningStandard.create({
    data: {
      organizationId: user.organizationId,
      code: parsed.data.code.trim(),
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
    },
    select: { id: true, code: true, title: true },
  });

  return NextResponse.json({ standard: row });
}
