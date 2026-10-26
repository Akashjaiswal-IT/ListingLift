import { describe, it, expect } from "vitest";
import { variationLabel } from "./variation-labels";

describe("variationLabel", () => {
  it("maps known variation ids in both languages", () => {
    expect(variationLabel("studio_white", false)).toBe("Pure White Studio");
    expect(variationLabel("studio_premium", true)).toBe("प्रीमियम पोडियम");
  });

  it("humanizes unknown ids and handles missing values", () => {
    expect(variationLabel("studio_soft_shadow", false)).toBe("Studio soft shadow");
    expect(variationLabel(undefined, false)).toBe("Studio");
  });
});
