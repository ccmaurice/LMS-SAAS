import type { Prisma, QuestionBankItem, QuestionType } from "@/generated/prisma/client";
import { parseDragDropFromQuestionSchema } from "@/lib/assessments/drag-drop-schema";
import { parseMcqOptions } from "@/lib/assessments/mcq";

export type QuestionCreateFieldsFromBank = Omit<
  Prisma.QuestionUncheckedCreateInput,
  "assessmentId" | "order"
>;

export function canReadQuestionBankItem(item: QuestionBankItem, organizationId: string): boolean {
  return item.organizationId == null || item.organizationId === organizationId;
}

/** Validates bank row; returns Prisma create payload fields for `Question` (without assessmentId/order). */
export function questionCreateDataFromBankItem(item: QuestionBankItem): {
  data: QuestionCreateFieldsFromBank;
  error?: string;
} {
  const type = item.type as QuestionType;
  const prompt = item.prompt.trim();
  if (!prompt) return { data: {} as QuestionCreateFieldsFromBank, error: "Empty prompt" };

  if (type === "MCQ") {
    const opts = parseMcqOptions(item.options);
    if (!opts || !opts.choices.some((c) => c.correct)) {
      return { data: {} as QuestionCreateFieldsFromBank, error: "MCQ bank item needs options.choices with one correct" };
    }
  }
  if (type === "TRUE_FALSE") {
    const v = item.correctAnswer?.trim().toLowerCase();
    if (v !== "true" && v !== "false") {
      return { data: {} as QuestionCreateFieldsFromBank, error: "TRUE_FALSE bank item needs correctAnswer true or false" };
    }
  }
  if (type === "DRAG_DROP") {
    const dd = parseDragDropFromQuestionSchema(item.questionSchema);
    if (!dd?.correct || Object.keys(dd.correct).length === 0) {
      return { data: {} as QuestionCreateFieldsFromBank, error: "DRAG_DROP bank item needs questionSchema.dragDrop" };
    }
  }
  if ((type === "LONG_ANSWER" || type === "ESSAY_RICH") && !item.markingScheme?.trim()) {
    return {
      data: {} as QuestionCreateFieldsFromBank,
      error: "LONG_ANSWER / ESSAY_RICH bank items should include a markingScheme for grading",
    };
  }

  return {
    data: {
      type,
      prompt,
      points: item.points > 0 && item.points <= 1000 ? item.points : 1,
      options: type === "MCQ" ? (item.options as Prisma.InputJsonValue) : undefined,
      correctAnswer:
        type === "SHORT_ANSWER" && item.correctAnswer?.trim()
          ? item.correctAnswer.trim()
          : type === "FORMULA" && item.correctAnswer?.trim()
            ? item.correctAnswer.trim()
            : type === "TRUE_FALSE" && item.correctAnswer
              ? item.correctAnswer.trim().toLowerCase()
              : null,
      markingScheme: item.markingScheme?.trim() || null,
      questionSchema:
        type === "DRAG_DROP" && item.questionSchema != null
          ? (item.questionSchema as Prisma.InputJsonValue)
          : undefined,
    },
  };
}
