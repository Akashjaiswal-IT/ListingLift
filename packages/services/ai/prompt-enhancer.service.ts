import OpenAI from "openai";
import { trackAIGeneration } from "./ai-observability";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || "sk-mock-key";
  return new OpenAI({ apiKey });
}

export interface PromptEnhancerParams {
  imageBuffers: Buffer[];
  userTitle?: string;
  userDescription?: string;
  userPrompt?: string;
}

export async function enhancePromptWithVision(
  params: PromptEnhancerParams
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Fallback for dev / tests if API key is placeholder
  if (!apiKey || apiKey.includes("YOUR_OPENAI_API_KEY")) {
    const customPromptPart = params.userPrompt ? `, ${params.userPrompt}` : "";
    return `Professional studio commercial product photography of ${params.userTitle || "the product"}${customPromptPart}. Crisp 8k resolution, clean minimalist podium, soft directional studio lighting, hyper-realistic textures, clean shadow falloff, commercial advertising style.`;
  }

  const openai = getOpenAIClient();

  const base64Images = params.imageBuffers.slice(0, 5).map((buf) => {
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${buf.toString("base64")}`,
        detail: "low" as const,
      },
    };
  });

  const promptText = `
You are an expert commercial advertising art director and e-commerce photographer.
Look at the attached product photos and write a photorealistic image generation prompt for Google Gemini/Imagen that describes ONLY the SCENE around the product: background, surface, lighting, mood and composition.
The attached photos show ONE product, possibly from multiple angles. Do NOT specify a camera angle, viewpoint, or which side of the product is shown.
Product Title (context only): ${params.userTitle || "Product"}
Product Description (context only): ${params.userDescription || "N/A"}
User's Custom Style Direction: ${params.userPrompt || "High-end clean e-commerce studio background"}

STRICT RULES:
1. DESCRIBE THE SCENE ONLY. Do NOT describe the product's parts, features, contents, materials or details - the reference photos are the only source of truth for the product itself.
2. NEVER introduce any object that touches, is inside, or is attached to the product (no items in pockets or holders, no accessories, no props leaning on or resting against it).
3. Product features in the title/description describe what the product CAN do; never depict them being used (e.g. bottle holders stay empty, bags stay closed/as photographed, no items placed in pockets).
4. Props are allowed only in the background, clearly separated from the product.
5. Keep lighting soft and diffuse with clean contact shadows beneath the base and zero clutter.
6. Return ONLY the final scene prompt string.
`;

  const startTime = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            ...base64Images,
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const latencySeconds = (Date.now() - startTime) / 1000;
    const enhanced = response.choices[0]?.message?.content?.trim();

    trackAIGeneration({
      provider: "openai",
      model: "gpt-4o-mini",
      input: promptText,
      output: enhanced || "",
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      latencySeconds,
    });

    if (enhanced) {
      return enhanced;
    }
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
    // Fall back to well-crafted template
  }

  return `Award-winning commercial product photography of ${params.userTitle || "the item"}, placed on a sleek minimalist architectural pedestal, soft cinematic studio lighting, elegant diffused reflections, 8k uhd, photorealistic, pristine details, ${params.userPrompt || "neutral luxury aesthetic"}.`;
}
