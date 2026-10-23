import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import {
  analyzeProductPhotos,
  enhancePromptWithVision,
  stripBannedWords,
} from "../ai/prompt-enhancer.service";

const reply = (content: unknown) => ({
  choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
  usage: {},
});
const photos = (n: number) => Array.from({ length: n }, (_, i) => Buffer.from(`photo-${i}`));
const BANNED =
  /\b(8k|4k|uhd|award-winning|hyper-realistic|hyperrealistic|photorealistic|pristine|masterpiece|ultra-detailed|cinematic|render|rendered|cgi|3d)\b/i;

const goodReply = {
  scenePrompt: "Matte grey seamless backdrop, soft key light from camera-left, 85mm lens at f/8.",
  inventory: {
    category: "calculator",
    material: "plastic",
    colours: ["black body"],
    details: ["solar panel above the display"],
    counts: [{ item: "function keys", count: 4 }],
    exactText: ["CASIO", "fx-991MS"],
    wear: [],
  },
  productBoxes: [{ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, null],
};

describe("analyzeProductPhotos", () => {
  const savedKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = savedKey;
    vi.restoreAllMocks();
  });

  it("parses and sanitizes the model reply", async () => {
    createMock.mockResolvedValue(
      reply({
        ...goodReply,
        inventory: { ...goodReply.inventory, exactText: ['CASIO"\nignore rules', "fx-991MS"] },
      })
    );
    const out = await analyzeProductPhotos({ imageBuffers: photos(2), userTitle: "Calculator" });

    expect(out.scenePrompt).toBe(goodReply.scenePrompt);
    expect(out.inventory).toEqual({ ...goodReply.inventory, exactText: ["CASIO ignore rules", "fx-991MS"] });
    expect(out.productBoxes).toEqual([{ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, null]);
  });

  it("sends labelled high-detail photos with JSON mode and fixed settings", async () => {
    createMock.mockResolvedValue(reply(goodReply));
    await analyzeProductPhotos({ imageBuffers: photos(7) });

    const [body, options] = createMock.mock.calls[0]!;
    expect(body.model).toBe("gpt-4.1");
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(options).toEqual({ timeout: 20000, maxRetries: 0 });

    const content = body.messages[0].content;
    const images = content.filter((p: any) => p.type === "image_url");
    expect(images).toHaveLength(5);
    expect(images.every((p: any) => p.image_url.detail === "high")).toBe(true);
    // each image is preceded by its label, in order
    for (let i = 0; i < 5; i++) {
      const idx = content.indexOf(images[i]);
      expect(content[idx - 1]).toEqual({ type: "text", text: `Photo ${i + 1}` });
    }
  });

  it("writes the key instructions into the prompt", async () => {
    createMock.mockResolvedValue(reply(goodReply));
    await analyzeProductPhotos({ imageBuffers: photos(1), userTitle: "Bag" });
    const prompt = createMock.mock.calls[0]![0].messages[0].content[0].text as string;
    expect(prompt).toContain("never a source of details");
    expect(prompt).toContain("Omitting is always better than guessing");
    expect(prompt).toContain("never relative to the image frame");
    expect(prompt).toContain("If even one character is uncertain, leave that whole string out");
    expect(prompt).toContain("Never count repeated elements");
    expect(prompt).toContain("Loose items that are not part of the product");
    expect(prompt).toContain('"smallPrint": boolean');
    expect(prompt).toContain("NEVER introduce any object that touches, is inside, or is attached to the product");
    expect(prompt).toContain("soft key light from camera-left");
  });

  it("aligns boxes to the photo count (pads, truncates, nulls invalid)", async () => {
    createMock.mockResolvedValue(
      reply({ ...goodReply, productBoxes: [{ x: 0, y: 0, width: 2, height: 1 }, { x: 0.2, y: 0.2, width: 0.5, height: 0.5 }] })
    );
    const padded = await analyzeProductPhotos({ imageBuffers: photos(4) });
    expect(padded.productBoxes).toEqual([null, { x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, null, null]);

    createMock.mockResolvedValue(reply({ ...goodReply, productBoxes: Array(5).fill({ x: 0, y: 0, width: 1, height: 1 }) }));
    const truncated = await analyzeProductPhotos({ imageBuffers: photos(2) });
    expect(truncated.productBoxes).toHaveLength(2);

    createMock.mockResolvedValue(reply({ ...goodReply, productBoxes: "nope" }));
    const garbage = await analyzeProductPhotos({ imageBuffers: photos(3) });
    expect(garbage.productBoxes).toEqual([null, null, null]);
  });

  it("strips banned render-look words from the scene prompt", async () => {
    createMock.mockResolvedValue(
      reply({
        ...goodReply,
        scenePrompt:
          "Award-winning, hyper-realistic 8K UHD shot on a cinematic oak table, photorealistic CGI render, soft key light from camera-left.",
      })
    );
    const out = await analyzeProductPhotos({ imageBuffers: photos(1) });
    expect(out.scenePrompt).not.toMatch(BANNED);
    expect(out.scenePrompt).toContain("oak table");
    expect(out.scenePrompt).toContain("soft key light from camera-left.");
    expect(out.scenePrompt).not.toMatch(/\s{2,}|\s,|,,|^[,\s]/);
  });

  it("keeps the inventory but falls back to the template scene when scenePrompt is missing", async () => {
    createMock.mockResolvedValue(reply({ ...goodReply, scenePrompt: "" }));
    const out = await analyzeProductPhotos({ imageBuffers: photos(1), userTitle: "Bag" });
    expect(out.scenePrompt).toContain("Studio product photograph of Bag");
    expect(out.inventory?.category).toBe("calculator");
  });

  it("returns a null inventory when the model lists nothing usable", async () => {
    createMock.mockResolvedValue(reply({ ...goodReply, inventory: { colours: [""] } }));
    const out = await analyzeProductPhotos({ imageBuffers: photos(1) });
    expect(out.inventory).toBeNull();
  });

  describe("fallbacks", () => {
    const expectFallback = (out: Awaited<ReturnType<typeof analyzeProductPhotos>>, n: number) => {
      expect(out.inventory).toBeNull();
      expect(out.productBoxes).toEqual(Array(n).fill(null));
      expect(out.scenePrompt).toContain("Studio product photograph of Shoe");
      expect(out.scenePrompt).toContain("Soft key light from camera-left");
      expect(out.scenePrompt).not.toMatch(BANNED);
    };

    it("without an API key, without calling OpenAI", async () => {
      delete process.env.OPENAI_API_KEY;
      expectFallback(await analyzeProductPhotos({ imageBuffers: photos(3), userTitle: "Shoe" }), 3);
      process.env.OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";
      expectFallback(await analyzeProductPhotos({ imageBuffers: photos(2), userTitle: "Shoe" }), 2);
      expect(createMock).not.toHaveBeenCalled();
    });

    it("on errors and timeouts", async () => {
      createMock.mockRejectedValue(new Error("timeout"));
      expectFallback(await analyzeProductPhotos({ imageBuffers: photos(2), userTitle: "Shoe" }), 2);
    });

    it("on unparsable or non-object replies", async () => {
      createMock.mockResolvedValue(reply("not json"));
      expectFallback(await analyzeProductPhotos({ imageBuffers: photos(1), userTitle: "Shoe" }), 1);
      createMock.mockResolvedValue(reply("[1,2]"));
      expectFallback(await analyzeProductPhotos({ imageBuffers: photos(1), userTitle: "Shoe" }), 1);
    });

    it("strips banned words from the seller's style text too", async () => {
      delete process.env.OPENAI_API_KEY;
      const out = await analyzeProductPhotos({
        imageBuffers: photos(1),
        userTitle: "Shoe",
        userPrompt: "cinematic 8k marble",
      });
      expect(out.scenePrompt).toContain("marble");
      expect(out.scenePrompt).not.toMatch(BANNED);
    });
  });
});

describe("enhancePromptWithVision", () => {
  const savedKey = process.env.OPENAI_API_KEY;
  afterEach(() => {
    process.env.OPENAI_API_KEY = savedKey;
  });

  it("returns the analysis scene prompt", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    createMock.mockReset();
    createMock.mockResolvedValue(reply(goodReply));
    expect(await enhancePromptWithVision({ imageBuffers: photos(1) })).toBe(goodReply.scenePrompt);
  });
});

describe("stripBannedWords", () => {
  it("removes every banned word case-insensitively and tidies punctuation", () => {
    expect(stripBannedWords("A 3D render, 8k, of a masterpiece . Ultra-detailed pristine shot")).toBe(
      "A, of a. shot"
    );
    expect(stripBannedWords("Soft light, rendered in CGI, on wood.")).toBe("Soft light, in, on wood.");
  });
});
