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

  const base64Images = params.imageBuffers.slice(0, 2).map((buf) => {
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
Analyze this product image and craft an ultra-detailed, photorealistic image generation prompt for Google Gemini/Imagen.
Product Title: ${params.userTitle || "Product"}
Product Description: ${params.userDescription || "N/A"}
User's Custom Style Direction: ${params.userPrompt || "High-end clean e-commerce studio background"}

STRICT PRODUCT FIDELITY & PRESENTABILITY RULES:
1. STRICT OBJECT IDENTITY FIDELITY (DO NOT MUTATE THE OBJECT):
   - You MUST NOT alter, add, replace, or remove any physical or visual details of the subject product.
   - NEVER add phantom accessories or elements (e.g. NEVER add chains, straps, pockets, badges, logos, patterns, buckles, or decorations that are not on the original item).
   - PRESERVE all existing hardware, logos, brand emblems, stitching, colorways, zippers, and textures exactly as they appear in the original photo.
2. ENHANCED ORIENTATION & PRESENTABILITY (MAKE IT LOOK COMMERCIALLY HEROIC):
   - You CAN and MUST improve the product's physical posture, staging, and orientation:
   - If the product was photographed slouched, crumpled, folded, tilted, or lying casually on a bed or floor (like a slouched backpack or folded apparel), straighten it upright, un-crumple and fill out its form naturally so its shape is crisp and fully structured, and stand it upright in an appealing 3D commercial presentation.
   - Present the product in its most flattering, symmetrical, well-staged, and eye-pleasing orientation.
3. ENVIRONMENT & LIGHTING:
   - Place the product in a pristine commercial setting with soft diffuse lighting, clean contact shadows beneath the base, zero clutter, zero unwanted artifacts.
4. Return ONLY the final enhanced generation prompt string.
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
      temperature: 0.7,
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
