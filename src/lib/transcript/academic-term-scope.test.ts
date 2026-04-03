import { describe, expect, it } from "vitest";
import { transcriptScopeDescription } from "@/lib/transcript/academic-term-scope.shared";

describe("transcriptScopeDescription", () => {
  it("returns null for all", () => {
    expect(transcriptScopeDescription({ kind: "all" }, [])).toBeNull();
  });

  it("formats single term (default labels)", () => {
    expect(
      transcriptScopeDescription({ kind: "single", termId: "t1" }, [
        { id: "t1", label: "Fall 2025" },
      ]),
    ).toBe("Term: Fall 2025");
  });

  it("formats range", () => {
    expect(
      transcriptScopeDescription({ kind: "range", fromTermId: "a", toTermId: "b" }, [
        { id: "a", label: "Fall 2024" },
        { id: "b", label: "Spring 2025" },
      ]),
    ).toBe("Terms: Fall 2024 — Spring 2025");
  });

  it("collapses identical range endpoints", () => {
    expect(
      transcriptScopeDescription({ kind: "range", fromTermId: "x", toTermId: "x" }, [{ id: "x", label: "Q1" }]),
    ).toBe("Term: Q1");
  });

  it("uses semester wording when passed", () => {
    expect(
      transcriptScopeDescription(
        { kind: "single", termId: "t1" },
        [{ id: "t1", label: "Fall 2025" }],
        { singular: "semester", plural: "semesters" },
      ),
    ).toBe("Semester: Fall 2025");
  });
});
