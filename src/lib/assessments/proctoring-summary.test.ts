import { describe, expect, it } from "vitest";
import { aggregateProctorEventsBySubmission, formatProctorSummaryLine } from "@/lib/assessments/proctoring-summary";

describe("aggregateProctorEventsBySubmission", () => {
  it("groups by submission and event type", () => {
    const agg = aggregateProctorEventsBySubmission([
      { submissionId: "s1", eventType: "window_blur" },
      { submissionId: "s1", eventType: "window_blur" },
      { submissionId: "s1", eventType: "document_hidden" },
      { submissionId: null, eventType: "window_blur" },
      { submissionId: "s2", eventType: "fullscreen_exit" },
    ]);
    expect(agg.s1).toEqual(
      expect.arrayContaining([
        { eventType: "document_hidden", count: 1 },
        { eventType: "window_blur", count: 2 },
      ]),
    );
    expect(agg.s1).toHaveLength(2);
    expect(agg.s2).toEqual([{ eventType: "fullscreen_exit", count: 1 }]);
  });
});

describe("formatProctorSummaryLine", () => {
  it("formats counts", () => {
    const line = formatProctorSummaryLine([
      { eventType: "window_blur", count: 2 },
      { eventType: "document_hidden", count: 1 },
    ]);
    expect(line).toContain("2×");
    expect(line).toContain("1×");
  });
});
