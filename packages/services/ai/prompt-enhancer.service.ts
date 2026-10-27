import OpenAI from "openai";
import { trackAIGeneration } from "./ai-observability";
import { aiOfflineFallbackAllowed } from "./offline-fallback";
import {
  sanitizeInventory,
  sanitizeProductBox,
  type ProductAnalysis,
  type ProductBox,
} from "./product-inventory";

// gpt-4.1 read printed text and product boxes correctly on real seller photos where gpt-4o-mini did not, and
// gpt-4o-mini bills ~15x more tokens per image, so per call it costs about the same or less.
export const PRODUCT_ANALYSIS_MODEL = "gpt-4.1";
const ANALYSIS_TIMEOUT_MS = 20000;
const ANALYSIS_MAX_RETRIES = 2;
const MAX_PHOTOS = 5;
const MAX_SCENE_CHARS = 1200;

export interface PromptEnhancerParams {
  imageBuffers: Buffer[];
  userTitle?: string;
  userDescription?: string;
  userPrompt?: string;
}

// These words push Gemini toward a glossy computer-render look instead of a real photograph.
const BANNED_WORDS_RE =
  /\b(?:8k|4k|uhd|award[\s-]?winning|hyper[\s-]?realistic|photo[\s-]?realistic|pristine|masterpiece|ultra[\s-]?detailed|cinematic|rendered|render|cgi|3d)\b/gi;

/** Removes render-look buzzwords and tidies the punctuation they leave behind. */
export function stripBannedWords(text: string): string {
  return text
    .replace(BANNED_WORDS_RE, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
    .replace(/[,;:]\s*\./g, ".")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:]+/, "")
    .trim();
}

function oneLine(text: string | undefined): string {
  return (text || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function fallbackScenePrompt(params: PromptEnhancerParams): string {
  const title = oneLine(params.userTitle) || "the product";
  const style = oneLine(params.userPrompt);
  const styleClause = style ? ` Styling direction: ${style}.` : "";
  return stripBannedWords(
    `Studio product photograph of ${title}, standing on a clean matte surface in front of a seamless neutral backdrop, nothing touching the product. Soft key light from camera-left through a large diffuser, daylight-balanced neutral colour, gentle fill from the right and a soft natural contact shadow under the base. Camera at product height with an 85mm lens at f/8 so the whole product is sharp, background softly out of focus. Clean, uncluttered e-commerce composition.${styleClause}`
  );
}

function fallbackAnalysis(params: PromptEnhancerParams): ProductAnalysis {
  return {
    scenePrompt: fallbackScenePrompt(params),
    inventory: null,
    productBoxes: params.imageBuffers.map(() => null),
  };
}

function alignBoxes(raw: unknown, photoCount: number): (ProductBox | null)[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: photoCount }, (_, i) => sanitizeProductBox(list[i]));
}

function buildAnalysisPrompt(params: PromptEnhancerParams, photoCount: number): string {
  return `You are a careful e-commerce product inspector and a commercial product photographer.
The ${photoCount} attached photo(s), labelled "Photo 1".."Photo ${photoCount}", show ONE product, possibly from several angles.
Product title (context for naming the category only): ${oneLine(params.userTitle) || "Product"}
Product description (context only): ${oneLine(params.userDescription) || "N/A"}
Seller's style direction for the scene: ${oneLine(params.userPrompt) || "High-end clean e-commerce studio background"}

Return ONLY a JSON object with this exact shape:
{"scenePrompt": string, "inventory": {"category": string, "material": string, "colours": string[], "details": string[], "counts": [{"item": string, "count": number}], "exactText": string[], "wear": string[], "smallPrint": boolean}, "productBoxes": [{"x": number, "y": number, "width": number, "height": number} or null, one entry per photo in order]}

PART 1 - INVENTORY (what is physically on the product):
- Use ONLY what you can see in the photos. The title and description are never a source of details - they only help you name the category.
- List only what is clearly visible. If you are not sure about something, leave it out. Omitting is always better than guessing.
- category: short product type (e.g. "backpack", "scientific calculator"). material: the main visible material.
- colours: the main colours with where they appear (e.g. "black body", "light-blue stripe on the front panel"). Max 6.
- details: distinctive visible features with their position. Describe positions and orientation relative to the product's OWN panels, seams and edges (e.g. "stripe runs down the front panel from the top seam, left of centre"), never relative to the image frame - photos are often taken at an angle, which can make a vertical stripe look diagonal. Max 12.
- counts: only distinct parts you can count with certainty and that number 10 or fewer (zip pulls, pockets, straps, buttons, card slots). Never count repeated elements such as keys, strap links, teeth, rivets, stitches or holes, and skip anything partly hidden. Max 10.
- exactText: printed or embossed text you can read with complete certainty, copied verbatim character for character with its exact capitalisation, including model numbers. If even one character is uncertain, leave that whole string out. Never include text shown on a screen or display (it changes). Max 12.
- smallPrint: true if the product carries lots of small printed text beyond its main brand name and model number - for example key or button legends, ingredient or nutrition lists, dense labels, scales or fine print. false otherwise.
- Loose items that are not part of the product - cards, cash, papers, tags, packaging, or anything placed inside or on it - are NOT part of the inventory. Never list them anywhere.
- wear: visible signs of use or damage (scuffs, scratches, peeling print, fading, frayed edges). Max 8.

PART 2 - productBoxes: for each photo, in the same order, a tight normalized box (0..1, x/y = top-left corner, width/height as fractions of the photo) that contains the ENTIRE product and nothing it does not need, measured carefully against the photo's edges. Use null if you are unsure.

PART 3 - scenePrompt: a scene brief for an image generator, written like a product photographer briefing a studio shoot.
- Describe ONLY the scene: backdrop and surface material, lighting, mood and composition. Do NOT describe the product's parts, features, contents, materials or details - the reference photos are the only source of truth for the product.
- Do NOT specify a camera angle around the product or which side of the product is shown.
- NEVER introduce any object that touches, is inside, or is attached to the product (no items in pockets or holders, no accessories, no props leaning on or resting against it).
- Features in the title/description describe what the product CAN do; never depict them being used (holders stay empty, bags stay closed as photographed, nothing placed in pockets).
- Props only in the background, clearly separated from the product. Zero clutter.
- Lighting: soft key light from camera-left, daylight-balanced neutral colour (to stay consistent with the rest of the set), soft fill, clean soft contact shadow under the base.
- State camera height, lens and aperture in plain photo terms (e.g. "camera at product height, 85mm lens at f/8").
- Use plain photographic language. Never use these words: 8K, 4K, UHD, award-winning, hyper-realistic, photorealistic, pristine, masterpiece, ultra-detailed, cinematic, render, rendered, CGI, 3D.
- 2 to 4 sentences.`;
}

/**
 * One vision call that returns the scene prompt, a must-keep inventory of what is
 * visible on the product, and a product box per photo. Throws when the analysis fails:
 * without the inventory the fidelity checks are blind, so the listing fails (and is
 * refunded) instead of running on a generic scene. The generic fallback is only used
 * with AI_OFFLINE_FALLBACK in local development.
 */
export async function analyzeProductPhotos(params: PromptEnhancerParams): Promise<ProductAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_OPENAI_API_KEY") || apiKey === "sk-mock-key") {
    if (aiOfflineFallbackAllowed()) return fallbackAnalysis(params);
    throw new Error("OpenAI is not configured (OPENAI_API_KEY)");
  }

  const photos = params.imageBuffers.slice(0, MAX_PHOTOS);
  if (photos.length === 0) throw new Error("No product photos to analyse");

  const promptText = buildAnalysisPrompt(params, photos.length);
  const imageParts = photos.flatMap((buf, i) => [
    { type: "text" as const, text: `Photo ${i + 1}` },
    {
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${buf.toString("base64")}`,
        // "high" is needed to read model numbers and small print (slightly more input tokens).
        detail: "high" as const,
      },
    },
  ]);

  const startTime = Date.now();
  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create(
      {
        model: PRODUCT_ANALYSIS_MODEL,
        messages: [{ role: "user", content: [{ type: "text", text: promptText }, ...imageParts] }],
        response_format: { type: "json_object" },
        max_tokens: 1200,
        temperature: 0.2,
      },
      // A failed analysis now fails the listing, so ride out brief blips (429/5xx/timeouts)
      { timeout: ANALYSIS_TIMEOUT_MS, maxRetries: ANALYSIS_MAX_RETRIES }
    );

    const raw = response.choices[0]?.message?.content?.trim() || "";
    trackAIGeneration({
      provider: "openai",
      model: PRODUCT_ANALYSIS_MODEL,
      input: promptText,
      output: raw,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      latencySeconds: (Date.now() - startTime) / 1000,
    });

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Unexpected product analysis reply");
    }

    const scene =
      typeof parsed.scenePrompt === "string"
        ? stripBannedWords(parsed.scenePrompt).slice(0, MAX_SCENE_CHARS).trim()
        : "";

    if (!scene) throw new Error("Product analysis returned no scene prompt");

    return {
      scenePrompt: scene,
      inventory: sanitizeInventory(parsed.inventory),
      productBoxes: alignBoxes(parsed.productBoxes, params.imageBuffers.length),
    };
  } catch (err) {
    trackAIGeneration({
      provider: "openai",
      model: PRODUCT_ANALYSIS_MODEL,
      input: promptText,
      output: "",
      latencySeconds: (Date.now() - startTime) / 1000,
      isError: true,
      errorMessage: String(err),
    });
    console.warn("Product photo analysis failed:", err);
    if (aiOfflineFallbackAllowed()) return fallbackAnalysis(params);
    throw err;
  }
}

/** Compatibility wrapper: the scene prompt only. */
export async function enhancePromptWithVision(params: PromptEnhancerParams): Promise<string> {
  return (await analyzeProductPhotos(params)).scenePrompt;
}
