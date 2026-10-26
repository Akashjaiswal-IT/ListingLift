import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "./format-date";

describe("formatDate", () => {
  const d = new Date(2026, 9, 25, 14, 5);

  it("uses day-month-year order in English", () => {
    expect(formatDate(d, false)).toMatch(/^25 Oct 2026$/);
  });

  it("uses Hindi month names in Hindi", () => {
    const out = formatDate(d, true);
    expect(out).toContain("25");
    expect(out).toContain("2026");
    expect(out).not.toContain("Oct");
  });

  it("accepts ISO strings and returns empty for invalid input", () => {
    expect(formatDate(d.toISOString(), false)).toContain("2026");
    expect(formatDate("not a date", false)).toBe("");
    expect(formatDateTime("not a date", true)).toBe("");
  });
});
