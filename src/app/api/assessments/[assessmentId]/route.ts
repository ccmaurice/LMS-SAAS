import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import {
  canManageAssessments,
  canStudentViewAssessment,
  getAssessmentInOrg,
} from "@/lib/assessments/access";
import { questionToStudentJson } from "@/lib/assessments/sanitize";
import { isStaffRole } from "@/lib/courses/access";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(20_000).optional().nullable(),
  kind: z.enum(["QUIZ", "EXAM"]).optional(),
  semester: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]).optional(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
  published: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, course: { organizationId: user.organizationId } },
    include: {
      course: { select: { id: true, title: true } },
      questions: { orderBy: { order: "asc" } },
    },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canView = await canStudentViewAssessment(user.id, user.role, assessment);
  if (!canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const staff = isStaffRole(user.role);
  let questionsOut = staff
    ? assessment.questions
    : assessment.questions.map((q) => questionToStudentJson(q));

  if (!staff && assessment.shuffleQuestions) {
    questionsOut = [...questionsOut].sort(() => Math.random() - 0.5);
  }

  return NextResponse.json({
    assessment: {
      id: assessment.id,
      courseId: assessment.courseId,
      title: assessment.title,
      description: assessment.description,
      kind: assessment.kind,
      semester: assessment.semester,
      timeLimitMinutes: assessment.timeLimitMinutes,
      published: assessment.published,
      shuffleQuestions: assessment.shuffleQuestions,
      course: assessment.course,
    },
    questions: questionsOut,
    staffView: staff,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageAssessments(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const assessment = await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description === null ? null : parsed.data.description.trim(),
      }),
      ...(parsed.data.kind !== undefined && { kind: parsed.data.kind }),
      ...(parsed.data.semester !== undefined && { semester: parsed.data.semester }),
      ...(parsed.data.timeLimitMinutes !== undefined && {
        timeLimitMinutes: parsed.data.timeLimitMinutes,
      }),
      ...(parsed.data.published !== undefined && { published: parsed.data.published }),
      ...(parsed.data.shuffleQuestions !== undefined && {
        shuffleQuestions: parsed.data.shuffleQuestions,
      }),
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ assessment });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.assessment.delete({ where: { id: assessmentId } });
  return NextResponse.json({ ok: true });
}
