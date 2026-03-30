import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { submissionTimedOut } from "@/lib/assessments/time";
import { gradeLongAnswerWithAi } from "@/lib/ai";
import { gradeAnswer } from "@/lib/assessments/grade";
import { recomputeSubmissionTotals } from "@/lib/assessments/score";
import { notifySubmissionGradedIfNew } from "@/lib/notifications/assessment-graded";

const bodySchema = z.object({
  answers: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, userId: user.id },
    include: { assessment: { include: { questions: { orderBy: { order: "asc" } } } } },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (submission.status !== "DRAFT") {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  if (submissionTimedOut(submission.startedAt, submission.assessment.timeLimitMinutes)) {
    return NextResponse.json({ error: "Time limit exceeded" }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const incoming = parsed.data.answers ?? {};
  const questions = submission.assessment.questions;

  for (const q of questions) {
    const content = incoming[q.id] ?? (await prisma.answer.findUnique({
      where: { submissionId_questionId: { submissionId, questionId: q.id } },
    }))?.content ?? "";

    const g = gradeAnswer(q, content);
    const data =
      g.autoGraded
        ? { content, score: g.score, autoGraded: true }
        : { content, score: null as number | null, autoGraded: false };

    await prisma.answer.upsert({
      where: { submissionId_questionId: { submissionId, questionId: q.id } },
      create: {
        submissionId,
        questionId: q.id,
        ...data,
      },
      update: data,
    });
  }

  for (const q of questions) {
    if (q.type !== "LONG_ANSWER" || !q.markingScheme?.trim()) continue;
    const content =
      incoming[q.id] ??
      (
        await prisma.answer.findUnique({
          where: { submissionId_questionId: { submissionId, questionId: q.id } },
        })
      )?.content ??
      "";
    const ai = await gradeLongAnswerWithAi({
      questionPrompt: q.prompt,
      markingScheme: q.markingScheme.trim(),
      studentAnswer: content,
      maxPoints: q.points,
    });
    await prisma.answer.update({
      where: { submissionId_questionId: { submissionId, questionId: q.id } },
      data: {
        content,
        score: ai.score,
        aiScore: ai.score,
        aiFeedback: ai.feedback,
        autoGraded: true,
      },
    });
  }

  await recomputeSubmissionTotals(submissionId);

  const answers = await prisma.answer.findMany({
    where: { submissionId },
    include: { question: true },
  });

  const allGraded = answers.every((a) => a.autoGraded || a.manualScore != null);

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: allGraded ? "GRADED" : "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  await notifySubmissionGradedIfNew(submissionId, false);

  const final = await prisma.submission.findUnique({ where: { id: submissionId } });

  return NextResponse.json({ submission: final });
}
