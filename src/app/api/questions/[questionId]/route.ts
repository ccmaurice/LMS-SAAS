import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { parseMcqOptions } from "@/lib/assessments/mcq";

const patchSchema = z
  .object({
    prompt: z.string().min(1).max(50_000).optional(),
    points: z.number().positive().max(1000).optional(),
    options: z
      .object({
        choices: z.array(
          z.object({
            id: z.string().min(1).max(64),
            text: z.string().min(1).max(2000),
            correct: z.boolean().optional(),
          }),
        ),
      })
      .optional(),
    correctAnswer: z.string().max(20_000).optional().nullable(),
    markingScheme: z.string().max(100_000).optional().nullable(),
    order: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.options) {
      const opts = parseMcqOptions(data.options);
      if (!opts || !opts.choices.some((c) => c.correct)) {
        ctx.addIssue({
          code: "custom",
          message: "MCQ choices need at least one correct: true",
        });
      }
    }
  });

export async function PATCH(req: Request, ctx: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const question = await prisma.question.findFirst({
    where: { id: questionId, assessment: { course: { organizationId: user.organizationId } } },
    include: { assessment: true },
  });
  if (!question) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: {
      ...(parsed.data.prompt !== undefined && { prompt: parsed.data.prompt.trim() }),
      ...(parsed.data.points !== undefined && { points: parsed.data.points }),
      ...(parsed.data.options !== undefined && { options: parsed.data.options as object }),
      ...(parsed.data.correctAnswer !== undefined && {
        correctAnswer:
          parsed.data.correctAnswer === null ? null : parsed.data.correctAnswer.trim(),
      }),
      ...(parsed.data.markingScheme !== undefined && {
        markingScheme: parsed.data.markingScheme === null ? null : parsed.data.markingScheme.trim(),
      }),
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  return NextResponse.json({ question: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const question = await prisma.question.findFirst({
    where: { id: questionId, assessment: { course: { organizationId: user.organizationId } } },
  });
  if (!question) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.question.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}
