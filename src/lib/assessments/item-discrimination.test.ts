import { describe, expect, it } from "vitest";
import {
  computeHighLow27Groups,
  computeItemDiscrimination27,
  pearsonBinaryVsContinuous,
} from "@/lib/assessments/item-discrimination";

describe("computeHighLow27Groups", () => {
  it("returns null for tiny samples", () => {
    expect(computeHighLow27Groups([])).toBeNull();
    expect(
      computeHighLow27Groups([
        { id: "a", totalScore: 1, maxScore: 10, answers: [] },
        { id: "b", totalScore: 2, maxScore: 10, answers: [] },
      ]),
    ).toBeNull();
  });

  it("splits low and high by score", () => {
    const subs = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      totalScore: i,
      maxScore: 10,
      answers: [] as { questionId: string; content: string }[],
    }));
    const g = computeHighLow27Groups(subs);
    expect(g).not.toBeNull();
    expect(g!.lowIds.size).toBeGreaterThan(0);
    expect(g!.highIds.size).toBeGreaterThan(0);
  });
});

describe("computeItemDiscrimination27", () => {
  it("separates MCQ correctness between high and low total-score groups", () => {
    const q = {
      id: "q1",
      order: 0,
      type: "MCQ" as const,
      prompt: "Q",
      points: 1,
      options: {
        choices: [
          { id: "a", text: "ok", correct: true },
          { id: "b", text: "bad", correct: false },
        ],
      },
      correctAnswer: null,
      questionSchema: null,
    };

    const mk = (id: string, pct: number, choice: "a" | "b") => ({
      id,
      totalScore: pct / 10,
      maxScore: 10,
      answers: [{ questionId: "q1", content: JSON.stringify({ choiceId: choice }) }],
    });

    const lowSubs = Array.from({ length: 8 }, (_, i) => mk(`L${i}`, 10 + i, "b"));
    const highSubs = Array.from({ length: 8 }, (_, i) => mk(`H${i}`, 90 + i, "a"));
    const rows = computeItemDiscrimination27([q], [...lowSubs, ...highSubs]);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.pLow).not.toBeNull();
    expect(r.pHigh).not.toBeNull();
    expect(r.pHigh!).toBeGreaterThan(r.pLow!);
    expect(r.dIndex).toBeGreaterThan(0.3);
    expect(r.pOverall).not.toBeNull();
    expect(r.nGraded).toBe(16);
    expect(r.pointBiserial).not.toBeNull();
    expect(r.pointBiserial!).toBeGreaterThan(0);
  });
});

describe("pearsonBinaryVsContinuous", () => {
  it("returns null for small n or no variance", () => {
    expect(pearsonBinaryVsContinuous([0, 1], [0.5, 0.6])).toBeNull();
    expect(pearsonBinaryVsContinuous([1, 1, 1, 1, 1], [1, 2, 3, 4, 5])).toBeNull();
  });

  it("matches known positive association", () => {
    const xs = [0, 0, 0, 0, 1, 1, 1, 1];
    const ys = [0.2, 0.25, 0.3, 0.35, 0.65, 0.7, 0.75, 0.8];
    const r = pearsonBinaryVsContinuous(xs, ys);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.9);
  });
});
