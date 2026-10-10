import { describe, it, expect } from "vitest";
import { nextCursor, initialCursor } from "./paginate";

describe("nextCursor", () => {
  it("advances by one page", () => {
    expect(nextCursor(10, 35, 10)).toBe(20);
    expect(nextCursor(20, 35, 10)).toBe(30);
  });

  it("clamps to the total on the last page", () => {
    expect(nextCursor(30, 35, 10)).toBe(35);
    expect(nextCursor(35, 35, 10)).toBe(35);
  });

  it("handles lists shorter than a page", () => {
    expect(nextCursor(0, 4, 10)).toBe(4);
  });
});

describe("initialCursor", () => {
  it("starts with the first page when the selection is visible", () => {
    expect(initialCursor(0, 35, 10)).toBe(10);
    expect(initialCursor(9, 35, 10)).toBe(10);
  });

  it("starts with the first page when nothing is selected", () => {
    expect(initialCursor(-1, 35, 10)).toBe(10);
  });

  it("extends to the next multiple of the page size to reveal the selection", () => {
    expect(initialCursor(10, 35, 10)).toBe(20);
    expect(initialCursor(19, 35, 10)).toBe(20);
    expect(initialCursor(20, 35, 10)).toBe(30);
  });

  it("clamps to the total", () => {
    expect(initialCursor(34, 35, 10)).toBe(35);
    expect(initialCursor(0, 4, 10)).toBe(4);
  });
});
