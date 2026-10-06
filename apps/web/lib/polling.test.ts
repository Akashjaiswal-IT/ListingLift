import { describe, it, expect } from "vitest";
import { adaptiveStatusInterval } from "./polling";

describe("adaptiveStatusInterval", () => {
  it("polls fast for the first few checks", () => {
    expect(adaptiveStatusInterval(0)).toBe(1500);
    expect(adaptiveStatusInterval(5)).toBe(1500);
  });

  it("backs off in the middle range", () => {
    expect(adaptiveStatusInterval(6)).toBe(3000);
    expect(adaptiveStatusInterval(15)).toBe(3000);
  });

  it("backs off furthest for long-running jobs", () => {
    expect(adaptiveStatusInterval(16)).toBe(5000);
    expect(adaptiveStatusInterval(100)).toBe(5000);
  });

  it("never returns a sub-second interval", () => {
    for (let i = 0; i < 50; i++) {
      expect(adaptiveStatusInterval(i)).toBeGreaterThanOrEqual(1000);
    }
  });
});
