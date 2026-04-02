import { describe, expect, it } from "vitest";
import {
  MAX_SCHOOL_PUBLIC_EXTRA_CARDS,
  parseSchoolPublicExtraCards,
} from "@/lib/school-public";

describe("parseSchoolPublicExtraCards", () => {
  it("returns empty for missing or blank input", () => {
    expect(parseSchoolPublicExtraCards(undefined)).toEqual([]);
    expect(parseSchoolPublicExtraCards(null)).toEqual([]);
    expect(parseSchoolPublicExtraCards("   ")).toEqual([]);
  });

  it("returns empty for invalid JSON or non-array", () => {
    expect(parseSchoolPublicExtraCards("{")).toEqual([]);
    expect(parseSchoolPublicExtraCards("{}")).toEqual([]);
    expect(parseSchoolPublicExtraCards("[]")).toEqual([]);
  });

  it("keeps cards with id and non-empty title", () => {
    const raw = JSON.stringify([
      { id: "a", title: " One ", body: "x", imageUrl: "", videoUrl: "" },
      { id: "", title: "No id", body: "", imageUrl: "", videoUrl: "" },
      { id: "b", title: "Two", body: "", imageUrl: "", videoUrl: "" },
    ]);
    const out = parseSchoolPublicExtraCards(raw);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("a");
    expect(out[0]!.title).toBe("One");
    expect(out[1]!.id).toBe("b");
  });

  it(`stops at ${MAX_SCHOOL_PUBLIC_EXTRA_CARDS} cards`, () => {
    const many = Array.from({ length: MAX_SCHOOL_PUBLIC_EXTRA_CARDS + 8 }, (_, i) => ({
      id: `id-${i}`,
      title: `T${i}`,
      body: "",
      imageUrl: "",
      videoUrl: "",
    }));
    expect(parseSchoolPublicExtraCards(JSON.stringify(many))).toHaveLength(MAX_SCHOOL_PUBLIC_EXTRA_CARDS);
  });
});
