import { describe, it, expect } from "vitest";
import { packDisplayName } from "./pack-names";

describe("packDisplayName", () => {
  it("returns the localized name for known packs", () => {
    expect(packDisplayName("trial", false)).toBe("Studio Kickstart");
    expect(packDisplayName("trial", true)).toBe("स्टूडियो किकस्टार्ट");
    expect(packDisplayName("topup", false)).toBe("Custom top-up");
  });

  it("falls back to the server name, then the id", () => {
    expect(packDisplayName("mystery", false, "Mystery Pack")).toBe("Mystery Pack");
    expect(packDisplayName("mystery", true)).toBe("mystery");
  });
});
