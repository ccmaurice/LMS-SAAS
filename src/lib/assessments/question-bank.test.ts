import { describe, expect, it } from "vitest";
import { questionCreateDataFromBankItem } from "@/lib/assessments/question-bank";
import type { QuestionBankItem } from "@/generated/prisma/client";

function mockItem(partial: Partial<QuestionBankItem>): QuestionBankItem {
  return {
    id: "qb1",
    organizationId: null,
    framework: "IB",
    subject: "Math",
    gradeLabel: null,
    standardCode: null,
    type: "MCQ",
    prompt: "Pick one",
    points: 1,
    options: {
      choices: [
        { id: "a", text: "Yes", correct: true },
        { id: "b", text: "No", correct: false },
      ],
    },
    correctAnswer: null,
    markingScheme: null,
    questionSchema: null,
    createdAt: new Date(),
    ...partial,
  };
}

describe("questionCreateDataFromBankItem", () => {
  it("accepts valid MCQ", () => {
    const { data, error } = questionCreateDataFromBankItem(mockItem({}));
    expect(error).toBeUndefined();
    expect(data.type).toBe("MCQ");
    expect(data.points).toBe(1);
  });

  it("rejects MCQ without a correct choice", () => {
    const { error } = questionCreateDataFromBankItem(
      mockItem({
        options: {
          choices: [
            { id: "a", text: "A", correct: false },
            { id: "b", text: "B", correct: false },
          ],
        },
      }),
    );
    expect(error).toMatch(/correct/);
  });

  it("accepts TRUE_FALSE with correctAnswer", () => {
    const { data, error } = questionCreateDataFromBankItem(
      mockItem({ type: "TRUE_FALSE", options: null, correctAnswer: "false" }),
    );
    expect(error).toBeUndefined();
    expect(data.correctAnswer).toBe("false");
  });

  it("requires markingScheme for ESSAY_RICH", () => {
    const { error } = questionCreateDataFromBankItem(
      mockItem({ type: "ESSAY_RICH", options: null, prompt: "Write an essay", markingScheme: null }),
    );
    expect(error).toMatch(/markingScheme/);
  });

  it("accepts ESSAY_RICH with markingScheme", () => {
    const { data, error } = questionCreateDataFromBankItem(
      mockItem({
        type: "ESSAY_RICH",
        options: null,
        prompt: "Write an essay",
        markingScheme: "Rubric: thesis, evidence, clarity",
      }),
    );
    expect(error).toBeUndefined();
    expect(data.type).toBe("ESSAY_RICH");
    expect(data.markingScheme).toContain("Rubric");
  });
});
