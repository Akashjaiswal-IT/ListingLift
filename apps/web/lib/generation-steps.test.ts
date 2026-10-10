import { describe, it, expect } from "vitest";
import { getStepStates } from "./generation-steps";

describe("getStepStates", () => {
  it("starts on the first row when queued with no stage", () => {
    expect(getStepStates("queued", undefined)).toEqual(["active", "pending", "pending", "pending"]);
    expect(getStepStates("pending", undefined)).toEqual(["active", "pending", "pending", "pending"]);
  });

  it("tracks each processing stage", () => {
    expect(getStepStates("processing", "preparing")).toEqual(["active", "pending", "pending", "pending"]);
    expect(getStepStates("processing", "enhancing_prompt")).toEqual(["done", "active", "pending", "pending"]);
    expect(getStepStates("processing", "rendering_images")).toEqual(["done", "done", "active", "pending"]);
    expect(getStepStates("processing", "rendering_cards")).toEqual(["done", "done", "done", "active"]);
  });

  it("marks everything done when completed", () => {
    expect(getStepStates("completed", "done")).toEqual(["done", "done", "done", "done"]);
    expect(getStepStates("completed", undefined)).toEqual(["done", "done", "done", "done"]);
  });

  it("marks the row of the last known stage as failed", () => {
    expect(getStepStates("failed", "preparing")).toEqual(["failed", "pending", "pending", "pending"]);
    expect(getStepStates("failed", "enhancing_prompt")).toEqual(["done", "failed", "pending", "pending"]);
    expect(getStepStates("failed", "rendering_images")).toEqual(["done", "done", "failed", "pending"]);
    expect(getStepStates("failed", "rendering_cards")).toEqual(["done", "done", "done", "failed"]);
  });

  it("marks the first row failed when the stage is unknown", () => {
    expect(getStepStates("failed", undefined)).toEqual(["failed", "pending", "pending", "pending"]);
    expect(getStepStates("failed", null)).toEqual(["failed", "pending", "pending", "pending"]);
    expect(getStepStates("failed", "something_else")).toEqual(["failed", "pending", "pending", "pending"]);
  });

  it("never returns an active row when failed", () => {
    for (const stage of [undefined, null, "preparing", "enhancing_prompt", "rendering_images", "rendering_cards", "done", "bogus"]) {
      const states = getStepStates("failed", stage);
      expect(states).not.toContain("active");
      expect(states.filter((s) => s === "failed")).toHaveLength(1);
    }
  });
});
