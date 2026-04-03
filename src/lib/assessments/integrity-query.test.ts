import { describe, expect, it } from "vitest";
import { buildProctoringWhere, parseIntegrityListFilters } from "@/lib/assessments/integrity-query";

describe("parseIntegrityListFilters", () => {
  it("defaults page to 1", () => {
    const f = parseIntegrityListFilters({});
    expect(f.page).toBe(1);
  });

  it("parses page and trims student", () => {
    const f = parseIntegrityListFilters({ student: "  bob  ", page: "3" });
    expect(f.student).toBe("bob");
    expect(f.page).toBe(3);
  });
});

describe("buildProctoringWhere", () => {
  it("includes assessment and optional filters", () => {
    const w = buildProctoringWhere("aid", {
      student: "x",
      eventType: "window_blur",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
    });
    expect(w.AND).toBeDefined();
    expect(Array.isArray(w.AND)).toBe(true);
    expect((w.AND as unknown[]).length).toBeGreaterThanOrEqual(4);
  });
});
