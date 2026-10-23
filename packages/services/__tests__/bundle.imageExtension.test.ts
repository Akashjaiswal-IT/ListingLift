import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { imageExtension } from "../download/bundle.service";

describe("imageExtension", () => {
  it("names files by their real format, not their storage key", async () => {
    const px = { create: { width: 4, height: 4, channels: 3 as const, background: "#888" } };
    expect(imageExtension(await sharp(px).jpeg().toBuffer())).toBe("jpg");
    expect(imageExtension(await sharp(px).png().toBuffer())).toBe("png");
    expect(imageExtension(await sharp(px).webp().toBuffer())).toBe("webp");
  });
});
