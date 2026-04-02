import { describe, expect, it } from "vitest";
import { PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP, USAGE_WEIGHTS } from "@/lib/platform/tenant-usage-weights";

describe("tenant usage weights — public page surface", () => {
  it("caps custom sections for weighted index below product max cards", () => {
    expect(PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP).toBeLessThanOrEqual(24);
    expect(USAGE_WEIGHTS.publicExtraSections).toBeGreaterThan(0);
  });
});
