import type { Question } from "@/generated/prisma/client";
import { parseMcqOptions } from "@/lib/assessments/mcq";
import { parseDragDropFromQuestionSchema } from "@/lib/assessments/drag-drop-schema";
import { stripHtmlToPlainText } from "@/lib/assessments/html-text";

export type GradeResult = {
  score: number;
  maxPoints: number;
  autoGraded: boolean;
};

function normalizeFormulaAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseFormulaStudentContent(content: string): string {
  try {
    const j = JSON.parse(content) as { latex?: string };
    if (typeof j.latex === "string") return j.latex;
  } catch {
    /* plain text */
  }
  return content;
}

export function gradeAnswer(
  question: Pick<Question, "type" | "points" | "options" | "correctAnswer" | "questionSchema">,
  content: string,
): GradeResult {
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
    const got = stripHtmlToPlainText(content).toLowerCase();
    const exp = question.correctAnswer.trim().toLowerCase();
    const ok = got === exp;
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

  if (question.type === "DRAG_DROP") {
    const dd = parseDragDropFromQuestionSchema(question.questionSchema);
    const correct = dd?.correct;
    if (!correct || Object.keys(correct).length === 0) {
      return { score: 0, maxPoints, autoGraded: false };
    }
    let assignments: Record<string, string> = {};
    try {
      const j = JSON.parse(content) as { assignments?: Record<string, string> };
      if (j.assignments && typeof j.assignments === "object") {
        assignments = j.assignments;
      }
    } catch {
      return { score: 0, maxPoints, autoGraded: true };
    }
    const keys = Object.keys(correct);
    let hits = 0;
    for (const k of keys) {
      if (assignments[k] === correct[k]) hits += 1;
    }
    const score = keys.length > 0 ? (hits / keys.length) * maxPoints : 0;
    return { score, maxPoints, autoGraded: true };
  }

  if (question.type === "FORMULA" && question.correctAnswer != null && question.correctAnswer.trim() !== "") {
    const got = normalizeFormulaAnswer(parseFormulaStudentContent(content));
    const exp = normalizeFormulaAnswer(question.correctAnswer);
    const ok = got === exp;
    return { score: ok ? maxPoints : 0, maxPoints, autoGraded: true };
  }

  if (question.type === "ESSAY_RICH") {
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
