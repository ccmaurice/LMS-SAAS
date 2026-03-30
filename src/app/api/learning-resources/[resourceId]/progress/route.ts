import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canViewLearningResource } from "@/lib/learning-resources/access";

const bodySchema = z.object({
  positionSec: z.number().min(0).optional(),
  percent: z.number().min(0).max(100).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const ok = await canViewLearningResource(user, resourceId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const pct = parsed.data.percent ?? 0;
  const pos = parsed.data.positionSec;

  const row = await prisma.resourceProgress.upsert({
    where: {
      userId_resourceId: { userId: user.id, resourceId },
    },
    create: {
      userId: user.id,
      resourceId,
      percent: pct,
      positionSec: pos ?? null,
    },
    update: {
      ...(pos != null ? { positionSec: pos } : {}),
      ...(parsed.data.percent != null ? { percent: pct } : {}),
    },
    select: { id: true, percent: true, positionSec: true },
  });

  return NextResponse.json({ progress: row });
}
