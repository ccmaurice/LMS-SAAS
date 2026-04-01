import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canPostCohortMessage, canReadCohortMessages } from "@/lib/school/cohort-access";

const postSchema = z.object({
  body: z.string().min(1).max(8000),
});

export async function GET(_req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const ok = await canReadCohortMessages(user.id, user.role, cohortId, user.organizationId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = await prisma.cohortMessage.findMany({
    where: { cohortId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      sender: m.user,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const canPost = await canPostCohortMessage(user.id, user.role, cohortId, user.organizationId);
  if (!canPost) return NextResponse.json({ error: "Only teachers and admins can post class messages" }, { status: 403 });

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

  const msg = await prisma.cohortMessage.create({
    data: {
      cohortId,
      userId: user.id,
      body: parsed.data.body.trim(),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });

  return NextResponse.json({
    message: {
      id: msg.id,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
      sender: msg.user,
    },
  });
}
