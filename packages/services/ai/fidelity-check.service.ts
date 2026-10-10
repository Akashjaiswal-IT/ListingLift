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

  const promptText = `You are a strict e-commerce quality inspector.
Compare the PRODUCT in the GENERATED image against the ORIGINAL product photo(s).
Ignore the background, lighting, shadows, props that do not touch the product, and the camera angle.
Look only for differences in the product itself: parts or objects ADDED (e.g. items placed in pockets or holders, extra straps, chains, accessories), parts REMOVED, or CHANGED (logo, text, colour, material, shape, pocket/compartment contents).
Respond ONLY with JSON: {"pass": boolean, "issues": string[]}.
"pass" is true only if the product is identical. "issues" lists concrete differences such as "water bottles added in side pockets", "extra strap", "logo changed". Use an empty list when pass is true.`;

  const originals = params.originalImages.slice(0, 3).flatMap((buf) => [
    { type: "text" as const, text: "ORIGINAL photo:" },
    {
      type: "image_url" as const,
      image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}`, detail: "low" as const },
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
