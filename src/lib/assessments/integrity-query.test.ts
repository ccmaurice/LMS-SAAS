import { describe, expect, it } from "vitest";
import {
  buildProctoringWhere,
  formatIntegrityPayloadForDisplay,
  parseIntegrityListFilters,
} from "@/lib/assessments/integrity-query";

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

  it("parses hideExcused", () => {
    expect(parseIntegrityListFilters({ hideExcused: "1" }).hideExcused).toBe(true);
    expect(parseIntegrityListFilters({}).hideExcused).toBe(false);
  });
});

describe("formatIntegrityPayloadForDisplay", () => {
  it("returns em dash for null", () => {
    expect(formatIntegrityPayloadForDisplay(null)).toBe("—");
  });

  it("stringifies plain objects", () => {
    expect(formatIntegrityPayloadForDisplay({ a: 1 })).toBe('{"a":1}');
  });
});

describe("buildProctoringWhere", () => {
  it("includes assessment and optional filters", () => {
    const w = buildProctoringWhere("aid", {
      student: "x",
      eventType: "window_blur",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      hideExcused: false,
    });
    expect(w.AND).toBeDefined();
    expect(Array.isArray(w.AND)).toBe(true);
    expect((w.AND as unknown[]).length).toBeGreaterThanOrEqual(4);
  });

  it("filters dismissed when hideExcused", () => {
    const w = buildProctoringWhere("aid", {
      student: "",
      eventType: "",
      fromDate: "",
      toDate: "",
      hideExcused: true,
    });
    const and = w.AND as Record<string, unknown>[];
    expect(and.some((x) => x.dismissedAt === null)).toBe(true);
  });
});
