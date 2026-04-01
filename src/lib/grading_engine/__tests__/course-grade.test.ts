import { describe, expect, it } from "vitest";
import type { OrganizationSettings } from "@/lib/education_context/schema";
import { computeWeightedSemesterPercent, gpaFromPercent, letterFromPercent } from "@/lib/grading_engine";

describe("grading_engine CA / exam weighting", () => {
  it("normalizes QUIZ 15/20 to 75% and EXAM 55/60 to ~91.67%", () => {
    const r = computeWeightedSemesterPercent({
      submissionPercents: [
        { kind: "QUIZ", percent: (15 / 20) * 100 },
        { kind: "EXAM", percent: (55 / 60) * 100 },
      ],
      weightContinuous: 0.5,
      weightExam: 0.5,
    });
    expect(r.continuousPercent).toBeCloseTo(75, 5);
    expect(r.examPercent).toBeCloseTo((55 / 60) * 100, 5);
    expect(r.percent).toBeCloseTo(0.5 * 75 + 0.5 * (55 / 60) * 100, 5);
  });

  it.each([
    { wCa: 0.4, wEx: 0.6 },
    { wCa: 0.5, wEx: 0.5 },
    { wCa: 0.6, wEx: 0.4 },
  ] as const)("matches weighted formula for weights $wCa / $wEx", ({ wCa, wEx }) => {
    const sCa = 75;
    const sEx = (55 / 60) * 100;
    const r = computeWeightedSemesterPercent({
      submissionPercents: [
        { kind: "QUIZ", percent: sCa },
        { kind: "EXAM", percent: sEx },
      ],
      weightContinuous: wCa,
      weightExam: wEx,
    });
    const sum = wCa + wEx;
    const nc = wCa / sum;
    const ne = wEx / sum;
    expect(r.percent).toBeCloseTo(nc * sCa + ne * sEx, 5);
  });

  it("collapses to exam-only weight when no CA submissions", () => {
    const r = computeWeightedSemesterPercent({
      submissionPercents: [{ kind: "EXAM", percent: 80 }],
      weightContinuous: 0.5,
      weightExam: 0.5,
    });
    expect(r.percent).toBe(80);
    expect(r.weightsUsed).toEqual({ continuous: 0, exam: 1 });
  });
});

describe("letter and GPA from org config", () => {
  it("letter matches default A band at 93+", () => {
    expect(letterFromPercent(93, {})).toBe("A");
    expect(letterFromPercent(92.9, {})).toBe("A-");
  });

  it("custom letter bands override defaults", () => {
    const settings: OrganizationSettings = {
      letterBands: [
        { minPercent: 80, letter: "P" },
        { minPercent: 0, letter: "NP" },
      ],
    };
    expect(letterFromPercent(85, settings)).toBe("P");
    expect(letterFromPercent(40, settings)).toBe("NP");
  });

  it("GPA only when gpaBands present (higher-ed style)", () => {
    const settings: OrganizationSettings = {
      gpaBands: [
        { minPercent: 90, gpa: 4.0 },
        { minPercent: 0, gpa: 0 },
      ],
    };
    expect(gpaFromPercent(91.67, settings)).toBe(4);
    expect(gpaFromPercent(40, settings)).toBe(0);
  });
});
