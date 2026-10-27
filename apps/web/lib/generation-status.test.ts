import { describe, it, expect } from "vitest";
import { isNeverStarted } from "./generation-status";

describe("isNeverStarted", () => {
  it("ignores 'uploaded' while the start request is still in flight", () => {
    expect(isNeverStarted("uploaded", true)).toBe(false);
  });

  it("treats 'uploaded' as never started once no start request is pending", () => {
    expect(isNeverStarted("uploaded", false)).toBe(true);
  });

  it("never flags a claimed or finished listing", () => {
    for (const status of ["queued", "processing", "completed", "failed", undefined]) {
      expect(isNeverStarted(status, false)).toBe(false);
    }
  });
});
