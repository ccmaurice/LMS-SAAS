import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { assertCourseInOrg } from "@/lib/assessments/access";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).optional().nullable(),
  kind: z.enum(["QUIZ", "EXAM"]).optional(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
  published: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isStaffRole(user.role)) {
    const assessments = await prisma.assessment.findMany({
      where: { courseId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { questions: true, submissions: true } } },
    });
    return NextResponse.json({ assessments });
  }

  const enrolled = await getEnrollment(user.id, courseId);
  if (!enrolled) {
    return NextResponse.json({ error: "Enroll in this course first" }, { status: 403 });
  }

  const assessments = await prisma.assessment.findMany({
    where: { courseId, published: true },
    orderBy: { title: "asc" },
    include: { _count: { select: { questions: true } } },
  });

  return NextResponse.json({ assessments });
}

export async function POST(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  const assessment = await prisma.assessment.create({
    data: {
      courseId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      kind: parsed.data.kind ?? "QUIZ",
      timeLimitMinutes: parsed.data.timeLimitMinutes ?? null,
      published: parsed.data.published ?? false,
      shuffleQuestions: parsed.data.shuffleQuestions ?? false,
      createdById: user.id,
    },
  });

  return NextResponse.json({ assessment });
}
