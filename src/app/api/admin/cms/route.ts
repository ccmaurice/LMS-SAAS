import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const patchSchema = z.object({
  key: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  value: z.string().max(50_000),
});

/** CMS strings — ADMIN only. */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const entries = await prisma.cmsEntry.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { key: "asc" },
    select: { id: true, key: true, value: true, updatedAt: true },
  });

  return NextResponse.json({ entries });
}

export async function PATCH(req: Request) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const entry = await prisma.cmsEntry.upsert({
    where: {
      organizationId_key: {
        organizationId: user.organizationId,
        key: parsed.data.key,
      },
    },
    create: {
      organizationId: user.organizationId,
      key: parsed.data.key,
      value: parsed.data.value,
    },
    update: { value: parsed.data.value },
    select: { id: true, key: true, value: true, updatedAt: true },
  });

  return NextResponse.json({ entry });
}
