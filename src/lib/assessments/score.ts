import { prisma } from "@/lib/db";
import { effectiveAnswerScore } from "@/lib/assessments/grade";

export async function recomputeSubmissionTotals(submissionId: string) {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { answers: { include: { question: true } } },
  });
  if (!sub) return;

  let totalScore = 0;
  let maxScore = 0;
  for (const a of sub.answers) {
    const max = a.question.points;
    maxScore += max;
    totalScore += effectiveAnswerScore(a, max);
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { totalScore, maxScore },
  });
}
