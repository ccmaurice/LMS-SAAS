import { describe, expect, it } from "vitest";
import {
  meanSubmittedScorePercent,
  outcomesListSearchParams,
  parseOutcomesListFilters,
  submitParticipationPercent,
  summarizeOutcomeSubmissions,
} from "@/lib/assessments/course-assessment-outcomes";

describe("meanSubmittedScorePercent", () => {
  it("returns null when no scored submissions", () => {
    expect(meanSubmittedScorePercent([])).toBeNull();
    expect(meanSubmittedScorePercent([{ totalScore: 8, maxScore: null, userId: "u1" }])).toBeNull();
    expect(meanSubmittedScorePercent([{ totalScore: 8, maxScore: 0, userId: "u1" }])).toBeNull();
  });

  it("averages percent of max", () => {
    const m = meanSubmittedScorePercent([
      { totalScore: 5, maxScore: 10, userId: "a" },
      { totalScore: 10, maxScore: 10, userId: "b" },
    ]);
    expect(m).toBe(75);
  });
});

describe("summarizeOutcomeSubmissions", () => {
  it("computes median min max and distinct students", () => {
    const s = summarizeOutcomeSubmissions([
      { totalScore: 0, maxScore: 10, userId: "a" },
      { totalScore: 5, maxScore: 10, userId: "b" },
      { totalScore: 10, maxScore: 10, userId: "c" },
    ]);
    expect(s.mean).toBe(50);
    expect(s.median).toBe(50);
    expect(s.min).toBe(0);
    expect(s.max).toBe(100);
    expect(s.distinctStudents).toBe(3);
    expect(s.attemptCount).toBe(3);
  });
});

describe("parseOutcomesListFilters", () => {
  it("defaults", () => {
    expect(parseOutcomesListFilters({})).toEqual({ show: "all", kind: "all", attention: "all" });
  });

  it("parses published and kind", () => {
    expect(parseOutcomesListFilters({ show: "published", kind: "QUIZ" })).toEqual({
      show: "published",
      kind: "QUIZ",
      attention: "all",
    });
  });

  it("parses attention=flagged", () => {
    expect(parseOutcomesListFilters({ attention: "flagged" })).toEqual({
      show: "all",
      kind: "all",
      attention: "flagged",
    });
  });
});

describe("outcomesListSearchParams", () => {
  it("includes attention=flagged when set", () => {
    const p = outcomesListSearchParams({
      show: "published",
      kind: "QUIZ",
      attention: "flagged",
    });
    expect(p.get("show")).toBe("published");
    expect(p.get("kind")).toBe("QUIZ");
    expect(p.get("attention")).toBe("flagged");
  });
});

describe("submitParticipationPercent", () => {
  it("returns null without enrollments", () => {
    expect(submitParticipationPercent(3, 0)).toBeNull();
  });

  it("caps at 100", () => {
    expect(submitParticipationPercent(10, 5)).toBe(100);
  });

  it("computes rate", () => {
    expect(submitParticipationPercent(2, 8)).toBe(25);
  });
});
