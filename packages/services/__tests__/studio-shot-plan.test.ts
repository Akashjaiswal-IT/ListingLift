import { describe, it, expect } from "vitest";
import { planStudioShots } from "../ai/gemini.service";

describe("planStudioShots", () => {
  it("keeps Quick Product behaviour: 1 photo / 2 images, always photo 0", () => {
    expect(planStudioShots(1, 2, false)).toEqual([
      { sourceIndex: 0, variation: "studio_white" },
      { sourceIndex: 0, variation: "studio_premium" },
    ]);
  });

  it("cycles variations by index when multiAngle is off", () => {
    const plan = planStudioShots(1, 5, false);
    expect(plan.map((s) => s.variation)).toEqual([
      "studio_white",
      "studio_premium",
      "lifestyle",
      "custom",
      "studio_white",
    ]);
    expect(plan.every((s) => s.sourceIndex === 0)).toBe(true);
  });

  it("falls back to the default plan for multiAngle with a single photo", () => {
    expect(planStudioShots(1, 2, true)).toEqual(planStudioShots(1, 2, false));
  });

  it("3 photos / 6 images: 3 white (angles 1,2,3) + 3 styled (angles 1,2,3)", () => {
    expect(planStudioShots(3, 6, true)).toEqual([
      { sourceIndex: 0, variation: "studio_white" },
      { sourceIndex: 1, variation: "studio_white" },
      { sourceIndex: 2, variation: "studio_white" },
      { sourceIndex: 0, variation: "studio_premium" },
      { sourceIndex: 1, variation: "lifestyle" },
      { sourceIndex: 2, variation: "studio_premium" },
    ]);
  });

  it("4 photos / 6 images: 4 white + 2 styled (angles 1,2)", () => {
    expect(planStudioShots(4, 6, true)).toEqual([
      { sourceIndex: 0, variation: "studio_white" },
      { sourceIndex: 1, variation: "studio_white" },
      { sourceIndex: 2, variation: "studio_white" },
      { sourceIndex: 3, variation: "studio_white" },
      { sourceIndex: 0, variation: "studio_premium" },
      { sourceIndex: 1, variation: "lifestyle" },
    ]);
  });

  it("5 photos / 6 images: 5 white + 1 styled (angle 1)", () => {
    expect(planStudioShots(5, 6, true)).toEqual([
      { sourceIndex: 0, variation: "studio_white" },
      { sourceIndex: 1, variation: "studio_white" },
      { sourceIndex: 2, variation: "studio_white" },
      { sourceIndex: 3, variation: "studio_white" },
      { sourceIndex: 4, variation: "studio_white" },
      { sourceIndex: 0, variation: "studio_premium" },
    ]);
  });

  it("stops at count when there are more photos than images", () => {
    expect(planStudioShots(5, 3, true)).toEqual([
      { sourceIndex: 0, variation: "studio_white" },
      { sourceIndex: 1, variation: "studio_white" },
      { sourceIndex: 2, variation: "studio_white" },
    ]);
  });
});
