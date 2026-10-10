import OpenAI from "openai";
import { trackAIGeneration } from "./ai-observability";

const FIDELITY_TIMEOUT_MS = 15000;

export interface ProductFidelityResult {
  pass: boolean;
  issues: string[];
}

/**
 * Asks a vision model whether the product in a generated image is identical to
 * the original photo(s). Fail-open: with no API key, or on any error, timeout or
 * unparsable reply, it returns { pass: true } so generation never breaks.
 */
export async function checkProductFidelity(params: {
  originalImages: Buffer[];
  generatedImage: Buffer;
}): Promise<ProductFidelityResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_OPENAI_API_KEY") || apiKey === "sk-mock-key") {
    return { pass: true, issues: [] };
  }

  // Generation intentionally straightens, smooths and re-lights the product, so
  // only concrete alterations count as failures - otherwise every good studio
  // shot gets rejected.
  const promptText = `You are an e-commerce quality inspector.
Compare the PRODUCT in the GENERATED image against the ORIGINAL product photo(s).
FAIL only for these concrete alterations:
1. A discrete object or part ADDED to the product (e.g. bottles in side pockets, an extra strap, chain, badge, accessory, items inside or attached to it).
2. A visible part REMOVED (e.g. a pocket, strap, zipper, handle, logo).
3. A logo, brand name or printed text CHANGED or INVENTED.
4. A clearly different base colour or material.
PASS (ignore) all of these - they are intended improvements: straightening or re-posing the product, a filled-out or smoother shape, wrinkles or creases removed, a cleaner or newer-looking surface, colour / white-balance / lighting correction, a different camera angle or crop, sharper detail, background and props that do not touch the product.
When unsure, PASS.
Respond ONLY with JSON: {"pass": boolean, "issues": string[]}.
Each issue must name the concrete thing added, removed or changed (e.g. "water bottles added in side pockets"). Use an empty list when pass is true.`;

  const originals = params.originalImages.slice(0, 2).flatMap((buf) => [
    { type: "text" as const, text: "ORIGINAL photo:" },
    {
      type: "image_url" as const,
      image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}`, detail: "high" as const },
    },
  ]);

  const startTime = Date.now();
  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              ...originals,
              { type: "text", text: "GENERATED image to verify:" },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${params.generatedImage.toString("base64")}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      },
      { timeout: FIDELITY_TIMEOUT_MS, maxRetries: 0 }
    );

    const raw = response.choices[0]?.message?.content?.trim() || "";

    trackAIGeneration({
      provider: "openai",
      model: "gpt-4o-mini",
      input: promptText,
      output: raw,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      latencySeconds: (Date.now() - startTime) / 1000,
    });

    const parsed = JSON.parse(raw);
    if (typeof parsed?.pass !== "boolean") {
      throw new Error("Unexpected fidelity check reply");
    }

    const issues: string[] = Array.isArray(parsed.issues)
      ? parsed.issues.map(String).filter((s: string) => s.trim())
      : [];
    if (!parsed.pass && issues.length === 0) {
      issues.push("product differs from the original photo");
    }
    return { pass: parsed.pass, issues: parsed.pass ? [] : issues };
  } catch (err) {
    trackAIGeneration({
      provider: "openai",
      model: "gpt-4o-mini",
      input: promptText,
      output: "",
      latencySeconds: (Date.now() - startTime) / 1000,
      isError: true,
      errorMessage: String(err),
    });
    console.warn("Product fidelity check failed, accepting image:", err);
    return { pass: true, issues: [] };
  }
}
