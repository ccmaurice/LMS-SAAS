import { describe, expect, it } from "vitest";
import { computeItemAnalysis } from "@/lib/assessments/item-analysis";

describe("computeItemAnalysis", () => {
  it("aggregates MCQ scores and option distribution", () => {
    const questions = [
      {
        id: "q1",
        order: 0,
        type: "MCQ" as const,
        prompt: "Pick",
        points: 2,
        options: {
          choices: [
            { id: "a", text: "Yes", correct: true },
            { id: "b", text: "No", correct: false },
          ],
        },
        correctAnswer: null,
        questionSchema: null,
      },
    ];
    const subs = [
      {
        answers: [
          {
            questionId: "q1",
            content: JSON.stringify({ choiceId: "a" }),
            score: 2,
            manualScore: null,
          },
        ],
      },
      {
        answers: [
          {
            questionId: "q1",
            content: JSON.stringify({ choiceId: "b" }),
            score: 0,
            manualScore: null,
          },
        ],
      },
    ];
    const rows = computeItemAnalysis(questions, subs);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.responseCount).toBe(2);
    expect(rows[0]!.meanPercent).toBe(50);
    expect(rows[0]!.fullCreditPercent).toBe(50);
    expect(rows[0]!.distributionLines?.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]!.distributionLines?.some((l) => l.includes("(key)"))).toBe(true);
  });

  it("computes true/false distribution", () => {
    const questions = [
      {
        id: "qtf",
        order: 0,
        type: "TRUE_FALSE" as const,
        prompt: "Sky blue?",
        points: 1,
        options: null,
        correctAnswer: "true",
        questionSchema: null,
      },
    ];
    const subs = [
      { answers: [{ questionId: "qtf", content: JSON.stringify({ value: true }), score: 1, manualScore: null }] },
      { answers: [{ questionId: "qtf", content: JSON.stringify({ value: true }), score: 1, manualScore: null }] },
      { answers: [{ questionId: "qtf", content: JSON.stringify({ value: false }), score: 0, manualScore: null }] },
    ];
    const rows = computeItemAnalysis(questions, subs);
    expect(rows[0]!.distributionLines?.join(" ")).toMatch(/True:/);
    expect(rows[0]!.distributionLines?.join(" ")).toMatch(/False:/);
  });

  it("notes pooled questions with no responses", () => {
    const questions = [
      {
        id: "qp",
        order: 0,
        type: "MCQ" as const,
        prompt: "Pool Q",
        points: 1,
        options: { choices: [{ id: "a", text: "A", correct: true }] },
        correctAnswer: null,
        questionSchema: null,
      },
    ];
    const rows = computeItemAnalysis(questions, [], {
      pooledQuestionIds: new Set(["qp"]),
      assessmentUsesPools: true,
    });
    expect(rows[0]!.note).toMatch(/Pool item/i);
  });
});
