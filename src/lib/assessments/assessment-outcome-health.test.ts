import { describe, expect, it } from "vitest";
import {
  assessmentOutcomeHealth,
  assessmentOutcomeNeedsAttention,
  publishedAssessmentOutcomeAttention,
} from "@/lib/assessments/assessment-outcome-health";

describe("assessmentOutcomeHealth", () => {
  it("flags low mean when published and enough attempts", () => {
    expect(
      assessmentOutcomeHealth({
        published: true,
        mean: 40,
        scoredAttemptCount: 6,
        participationPercent: 50,
        enrolledCount: 20,
      }).lowMean,
    ).toBe(true);
  });

  it("does not flag draft assessments", () => {
    expect(
      assessmentOutcomeHealth({
        published: false,
        mean: 20,
        scoredAttemptCount: 10,
        participationPercent: 10,
        enrolledCount: 20,
      }),
    ).toEqual({ lowMean: false, lowReach: false });
  });

  it("flags low reach", () => {
    expect(
      assessmentOutcomeHealth({
        published: true,
        mean: 80,
        scoredAttemptCount: 2,
        participationPercent: 20,
        enrolledCount: 10,
      }).lowReach,
    ).toBe(true);
  });

  it("does not flag mean at threshold (strictly below 42.5%)", () => {
    expect(
      assessmentOutcomeHealth({
        published: true,
        mean: 42.5,
        scoredAttemptCount: 10,
        participationPercent: 50,
        enrolledCount: 20,
      }).lowMean,
    ).toBe(false);
  });

  it("does not flag low mean with too few scored attempts", () => {
    expect(
      assessmentOutcomeHealth({
        published: true,
        mean: 10,
        scoredAttemptCount: 4,
        participationPercent: 100,
        enrolledCount: 4,
      }).lowMean,
    ).toBe(false);
  });

  it("does not flag reach when enrollment is below minimum", () => {
    expect(
      assessmentOutcomeHealth({
        published: true,
        mean: 80,
        scoredAttemptCount: 5,
        participationPercent: 10,
        enrolledCount: 7,
      }).lowReach,
    ).toBe(false);
  });

  it("does not flag reach at participation threshold", () => {
    expect(
      assessmentOutcomeHealth({
        published: true,
        mean: 80,
        scoredAttemptCount: 5,
        participationPercent: 28,
        enrolledCount: 10,
      }).lowReach,
    ).toBe(false);
  });
});

describe("assessmentOutcomeNeedsAttention", () => {
  it("is true when either flag is set", () => {
    expect(
      assessmentOutcomeNeedsAttention({
        published: true,
        mean: 40,
        scoredAttemptCount: 6,
        participationPercent: 50,
        enrolledCount: 20,
      }),
    ).toBe(true);
    expect(
      assessmentOutcomeNeedsAttention({
        published: true,
        mean: 90,
        scoredAttemptCount: 2,
        participationPercent: 10,
        enrolledCount: 10,
      }),
    ).toBe(true);
  });

  it("is false when neither flag applies", () => {
    expect(
      assessmentOutcomeNeedsAttention({
        published: true,
        mean: 80,
        scoredAttemptCount: 6,
        participationPercent: 80,
        enrolledCount: 10,
      }),
    ).toBe(false);
  });
});

describe("publishedAssessmentOutcomeAttention", () => {
  it("matches needsAttention with derived participation", () => {
    expect(
      publishedAssessmentOutcomeAttention({
        meanPercent: 40,
        scoredAttemptCount: 6,
        distinctSubmitters: 5,
        enrolledCount: 20,
      }),
    ).toBe(true);
    expect(
      publishedAssessmentOutcomeAttention({
        meanPercent: 80,
        scoredAttemptCount: 6,
        distinctSubmitters: 8,
        enrolledCount: 10,
      }),
    ).toBe(false);
  });
});
