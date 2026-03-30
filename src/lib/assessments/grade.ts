import type { Question } from "@/generated/prisma/client";
import { parseMcqOptions } from "@/lib/assessments/mcq";

export type GradeResult = {
  score: number;
  maxPoints: number;
  autoGraded: boolean;
};

export function gradeAnswer(question: Pick<Question, "type" | "points" | "options" | "correctAnswer">, content: string): GradeResult {
  const maxPoints = question.points;

  if (question.type === "MCQ") {
    let choiceId: string | undefined;
    try {
      const j = JSON.parse(content) as { choiceId?: string; id?: string };
      choiceId = j.choiceId ?? j.id;
    } catch {
      return { score: 0, maxPoints, autoGraded: true };
    }
    if (!choiceId || typeof choiceId !== "string") {
      return { score: 0, maxPoints, autoGraded: true };
    }
    const opts = parseMcqOptions(question.options);
    const chosen = opts?.choices.find((c) => c.id === choiceId);
    const correct = Boolean(chosen?.correct);
    return { score: correct ? maxPoints : 0, maxPoints, autoGraded: true };
  }

  if (question.type === "SHORT_ANSWER" && question.correctAnswer != null && question.correctAnswer !== "") {
    const ok = content.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    return { score: ok ? maxPoints : 0, maxPoints, autoGraded: true };
  }

  if (question.type === "TRUE_FALSE") {
    const expected = question.correctAnswer?.trim().toLowerCase();
    if (expected !== "true" && expected !== "false") {
      return { score: 0, maxPoints, autoGraded: true };
    }
    let v: boolean | undefined;
    try {
      const j = JSON.parse(content) as { value?: boolean };
      if (typeof j.value === "boolean") v = j.value;
    } catch {
      /* ignore */
    }
    const ok = v === (expected === "true");
    return { score: ok ? maxPoints : 0, maxPoints, autoGraded: true };
  }

  if (question.type === "LONG_ANSWER") {
    return { score: 0, maxPoints, autoGraded: false };
  }

  return { score: 0, maxPoints, autoGraded: false };
}

export function effectiveAnswerScore(
  answer: { score: number | null; manualScore: number | null },
  maxPoints: number,
): number {
  if (answer.manualScore != null) return Math.min(maxPoints, Math.max(0, answer.manualScore));
  if (answer.score != null) return Math.min(maxPoints, Math.max(0, answer.score));
  return 0;
}
