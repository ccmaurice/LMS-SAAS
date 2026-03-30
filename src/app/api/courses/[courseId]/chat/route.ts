import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canAccessCourseChat } from "@/lib/learning-resources/access";

const postSchema = z.object({
  body: z.string().min(1).max(4000).trim(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const ok = await canAccessCourseChat(user, courseId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.courseChatMessage.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const ok = await canAccessCourseChat(user, courseId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const message = await prisma.courseChatMessage.create({
    data: {
      courseId,
      userId: user.id,
      body: parsed.data.body,
    },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json({ message });
}
