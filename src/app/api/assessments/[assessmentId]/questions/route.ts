import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { parseMcqOptions } from "@/lib/assessments/mcq";

const choiceSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(2000),
  correct: z.boolean().optional(),
});

const mediaSchema = z.array(
  z.object({
    kind: z.enum(["image", "video", "audio"]),
    url: z.string().url().max(2000),
  }),
);

const bodySchema = z
  .object({
    type: z.enum(["MCQ", "SHORT_ANSWER", "LONG_ANSWER", "TRUE_FALSE"]),
    prompt: z.string().min(1).max(50_000),
    points: z.number().positive().max(1000).optional(),
    options: z
      .object({
        choices: z.array(choiceSchema).min(2),
      })
      .optional(),
    correctAnswer: z.string().max(20_000).optional().nullable(),
    markingScheme: z.string().max(100_000).optional().nullable(),
    mediaAttachments: mediaSchema.optional().nullable(),
    order: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "MCQ") {
      const opts = data.options ? parseMcqOptions(data.options) : null;
      if (!opts || !opts.choices.some((c) => c.correct)) {
        ctx.addIssue({
          code: "custom",
          message: "MCQ requires options.choices with at least one correct: true",
        });
      }
    }
    if (data.type === "TRUE_FALSE") {
      const v = data.correctAnswer?.trim().toLowerCase();
      if (v !== "true" && v !== "false") {
        ctx.addIssue({
          code: "custom",
          message: "TRUE_FALSE requires correctAnswer \"true\" or \"false\"",
        });
      }
    }
  });

export async function POST(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const maxOrder = await prisma.question.aggregate({
    where: { assessmentId },
    _max: { order: true },
  });
  const order = parsed.data.order ?? (maxOrder._max.order ?? -1) + 1;

  const question = await prisma.question.create({
    data: {
      assessmentId,
      type: parsed.data.type,
      prompt: parsed.data.prompt.trim(),
      order,
      points: parsed.data.points ?? 1,
      options: parsed.data.type === "MCQ" ? (parsed.data.options as object) : undefined,
      correctAnswer:
        parsed.data.type === "SHORT_ANSWER" && parsed.data.correctAnswer
          ? parsed.data.correctAnswer.trim()
          : parsed.data.type === "TRUE_FALSE" && parsed.data.correctAnswer
            ? parsed.data.correctAnswer.trim().toLowerCase()
            : null,
      markingScheme: parsed.data.markingScheme?.trim() || null,
      mediaAttachments: parsed.data.mediaAttachments ?? undefined,
    },
  });

  return NextResponse.json({ question });
}
