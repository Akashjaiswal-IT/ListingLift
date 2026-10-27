import OpenAI from "openai";
import { IAiGeneratedText } from "@repo/database";
import { trackAIGeneration } from "./ai-observability";
import { aiOfflineFallbackAllowed } from "./offline-fallback";
import { normalizePricing, buildPriceLine, formatINR, findDisallowedAmounts } from "../pricing/price";
import { sanitizeInventory, inventoryToCopyFacts, type ProductInventory } from "./product-inventory";

const PRICE_LINE_TOKEN = "{{PRICE_LINE}}";

// Platform limits (verified 2025/26):
// - Amazon India title policy (Jan 2025): 200 chars; bans ! $ ? _ { } ^ ¬ ¦ and promo phrases.
// - Google SERP: title truncates ~60 chars, meta description ~160.
// - Instagram (Dec 2025): max 5 hashtags per post/reel.
const MARKETPLACE_TITLE_MAX = 200;
const SEO_TITLE_MAX = 60;
const SEO_DESC_MAX = 160;
const MAX_HASHTAGS = 5;

// Characters Amazon bans in titles (unless part of a registered brand name).
const BANNED_TITLE_CHARS = /[!$?_{}^¬¦]/g;
// Banned/weak promotional claims — removed from titles as a safety net even if the model emits them.
const PROMO_PHRASES = [
  "best seller",
  "bestseller",
  "top rated",
  "top-rated",
  "best price online",
  "best price",
  "lowest price",
  "cheapest",
  "number one",
  "#1",
  "100% genuine",
];
// A line in a WhatsApp caption that carries a link or a phone number — the server writes the
// contact line itself (from the seller's saved number), so any model-written one is dropped.
const URL_OR_PHONE = /(https?:\/\/|wa\.me|api\.whatsapp|\b\d[\d\s-]{8,}\d\b)/i;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || "sk-mock-key";
  return new OpenAI({ apiKey });
}

export interface SellerFacts {
  cod?: boolean;
  freeDelivery?: boolean;
  easyReturns?: boolean;
  madeInIndia?: boolean;
}

export interface GenerateTextParams {
  userTitle: string;
  userDescription?: string;
  userPrompt?: string;
  price?: number;
  discountPrice?: number;
  sizes?: string[];
  variants?: string[];
  ctaText?: string;
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  originalImageUrls?: string[];
  /** Copy language; comes from the seller's card settings. Defaults to English. */
  language?: "en" | "hi";
  /** What the photo analysis saw on the product — so the copy describes the real item, not a guess. */
  productInventory?: ProductInventory | null;
  /** Trust claims the seller has actually turned on; nothing else (COD, delivery, returns...) is printed. */
  sellerFacts?: SellerFacts;
}

/** Trust claims the seller has enabled, as printable labels. Empty when the seller enabled none. */
function sellerFactLabels(facts: SellerFacts | undefined, hi: boolean): string[] {
  if (!facts) return [];
  const out: string[] = [];
  if (facts.cod) out.push(hi ? "कैश ऑन डिलीवरी उपलब्ध" : "Cash on Delivery available");
  if (facts.freeDelivery) out.push(hi ? "फ्री डिलीवरी" : "Free delivery");
  if (facts.easyReturns) out.push(hi ? "आसान रिटर्न" : "Easy returns");
  if (facts.madeInIndia) out.push(hi ? "मेड इन इंडिया" : "Made in India");
  return out;
}

/** Trims text to a character budget at a word boundary, without adding an ellipsis. */
function clampWords(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Removes weak/banned promotional phrases and collapses the leftover spacing. */
function stripPromo(text: string): string {
  let out = text;
  for (const phrase of PROMO_PHRASES) {
    out = out.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/** Makes a marketplace title Amazon-safe: no banned characters, no promo phrases, within the cap. */
function cleanMarketplaceTitle(text: string): string {
  const cleaned = stripPromo(text.replace(BANNED_TITLE_CHARS, " "))
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .trim();
  return clampWords(cleaned, MARKETPLACE_TITLE_MAX);
}

/** Normalises one hashtag to "#word" (letters/digits only); returns "" when nothing usable is left. */
function cleanHashtag(raw: string): string {
  const body = raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}]/gu, "");
  return body ? `#${body}` : "";
}

/** Order line written by the server from the seller's own saved contact, so the number is always right. */
function buildContactLine(params: GenerateTextParams, hi: boolean): string {
  const store = (params.storeName || "").trim();
  const phone = (params.whatsappNumber || "").replace(/[^0-9]/g, "");
  const handle = (params.instagramHandle || "").replace(/^@/, "").trim();
  const storeSuffix = store ? ` — ${store}` : "";
  if (phone) {
    const pretty = phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
    return hi ? `📲 ऑर्डर के लिए व्हाट्सएप: ${pretty}${storeSuffix}` : `📲 Order on WhatsApp: ${pretty}${storeSuffix}`;
  }
  if (handle) {
    return hi ? `📩 ऑर्डर के लिए DM करें @${handle}` : `📩 DM @${handle} to order`;
  }
  return store ? `🛍️ ${store}` : "";
}

export function generateFallbackListingText(params: GenerateTextParams): IAiGeneratedText {
  const hi = params.language === "hi";
  const title = params.userTitle?.trim() || (hi ? "नया प्रोडक्ट" : "New Product");
  const inv = sanitizeInventory(params.productInventory);
  const category = inv?.category?.trim();
  const material = inv?.material?.trim();
  const colours = inv?.colours ?? [];
  const pricing = normalizePricing(params.price, params.discountPrice);
  const priceLine = buildPriceLine(pricing);
  const offer = pricing.selling !== undefined ? formatINR(pricing.selling) : "";
  const trust = sellerFactLabels(params.sellerFacts, hi);
  const hasSizes = (params.sizes?.length ?? 0) > 0;
  const sizesStr = params.sizes?.join(", ") ?? "";

  // Features come only from what the photo actually showed, plus seller-entered sizes — nothing invented.
  const keyFeatures: string[] = [];
  if (material) keyFeatures.push(hi ? `मटेरियल: ${material}` : `Material: ${material}`);
  if (colours.length) keyFeatures.push(hi ? `रंग: ${colours.join(", ")}` : `Colour: ${colours.join(", ")}`);
  for (const d of inv?.details?.slice(0, 2) ?? []) keyFeatures.push(d);
  if (hasSizes) keyFeatures.push(hi ? `उपलब्ध साइज़: ${sizesStr}` : `Available sizes: ${sizesStr}`);
  if (keyFeatures.length === 0) {
    keyFeatures.push(hi ? `${title}${category ? ` (${category})` : ""}` : `${title}${category ? ` (${category})` : ""}`);
  }

  // Keywords from real product words only.
  const titleWords = title.split(/\s+/).filter((w) => w.length > 2);
  const keywords = Array.from(
    new Set([title.toLowerCase(), ...(category ? [category.toLowerCase()] : []), ...colours.map((c) => c.toLowerCase()), ...titleWords.map((w) => w.toLowerCase())])
  ).slice(0, 8);

  const marketTitle = cleanMarketplaceTitle([title, category].filter(Boolean).join(" "));

  const hashSource = Array.from(new Set([...titleWords, ...(category ? [category] : [])]));
  const instagramHashtags = hashSource.map((w) => cleanHashtag(w)).filter(Boolean).slice(0, MAX_HASHTAGS);

  const descLines = [
    hi ? `प्रोडक्ट: ${title}` : `Product: ${title}`,
    ...(category ? [hi ? `प्रकार: ${category}` : `Type: ${category}`] : []),
    ...(material ? [hi ? `मटेरियल: ${material}` : `Material: ${material}`] : []),
    ...(colours.length ? [hi ? `रंग: ${colours.join(", ")}` : `Colour: ${colours.join(", ")}`] : []),
    ...(hasSizes ? [hi ? `साइज़: ${sizesStr}` : `Sizes: ${sizesStr}`] : []),
    ...trust,
  ];

  const waLines = [
    `*${title}*`,
    ...(priceLine ? [priceLine] : []),
    ...trust.map((t) => `✅ ${t}`),
  ];
  const contact = buildContactLine(params, hi);
  if (contact) waLines.push("", contact);

  const igFirst = [title, category, colours[0]].filter(Boolean).join(" · ");

  return {
    seoTitle: clampWords(stripPromo(title), SEO_TITLE_MAX),
    seoDescription: clampWords(
      (hi ? `${title} ऑनलाइन` : `${title} online`) +
        (offer ? ` – ${offer}` : "") +
        (trust.length ? ` · ${trust.join(" · ")}` : ""),
      SEO_DESC_MAX
    ),
    keyFeatures: keyFeatures.slice(0, 4),
    keywords,
    meeshoListing: {
      title: marketTitle,
      description: descLines.join("\n"),
      category: category || (hi ? "सामान्य" : "General"),
      subcategory: category || "",
    },
    whatsappCaption: waLines.join("\n").trim(),
    instagramCaption: hi
      ? `${igFirst}${trust.length ? `\n${trust.join(" · ")}` : ""}`
      : `${igFirst}${trust.length ? `\n${trust.join(" · ")}` : ""}`,
    instagramHashtags,
  };
}

export function buildPrompts(params: GenerateTextParams) {
  const hi = params.language === "hi";
  const langName = hi ? "Hindi (Devanagari script)" : "English";
  const pricing = normalizePricing(params.price, params.discountPrice);
  const facts = sellerFactLabels(params.sellerFacts, false); // English labels for the prompt
  const copyFacts = inventoryToCopyFacts(params.productInventory);

  const trustRule = facts.length
    ? `The seller offers ONLY these and you may mention ONLY these: ${facts.join(", ")}.`
    : `The seller has NOT confirmed any delivery, COD, return, warranty or origin claim. Do NOT mention Cash on Delivery, free delivery, returns, exchange, warranty, guarantee, or country of origin anywhere.`;

  const systemPrompt = `You are Peshkar AI's e-commerce copywriter for Indian sellers (Amazon, Flipkart, Meesho, Shopify, Instagram, WhatsApp).
Write copy that is accurate, trustworthy and genuinely helps the product sell and rank.

ACCURACY RULES (most important):
- Describe ONLY what you are told. NEVER invent material, fabric, size, fit, colour, origin, certification, or features that are not given.
- NEVER claim delivery speed, Cash on Delivery, free delivery, returns, exchange, warranty or guarantee unless explicitly allowed below.
- NEVER create false urgency or scarcity ("hurry", "stock running out", "limited time", "only few left").
- NEVER use banned promotional words in titles: "best seller", "#1", "top rated", "best price", "lowest price", "cheapest".
- Do NOT use these characters in any title: ! $ ? _ { } ^
- ${trustRule}

PRICE RULE:
- NEVER write any price, amount, discount percentage or currency figure anywhere.
- In whatsappCaption, put the exact token ${PRICE_LINE_TOKEN} on its own line where the price should go. Do not write contact numbers or links in whatsappCaption — those are added separately.

LANGUAGE: Write seoDescription, keyFeatures, meeshoListing.description, whatsappCaption and instagramCaption in ${langName}. Keep brand names and model numbers in their original script. Titles may stay in English/transliterated for search.

OUTPUT: Respond ONLY with valid raw JSON matching the requested structure — no markdown, no commentary.`;

  const userContent = `
Product facts (the only truth — do not add to these):
- Seller's title: ${params.userTitle || "Product"}
- Seller's notes: ${params.userDescription || "none"}
- Custom instructions: ${params.userPrompt || "none"}
- Sizes: ${params.sizes?.length ? params.sizes.join(", ") : "none given"}
- Variants/colours: ${params.variants?.length ? params.variants.join(", ") : "none given"}
${copyFacts ? `\nWhat the product photo shows (use this to describe the real item):\n${copyFacts}\n` : ""}
Pricing context (for your judgement only — never print numbers): ${pricing.selling !== undefined ? "a selling price exists" : "no price given"}.

Produce JSON with EXACTLY these keys:
{
  "seoTitle": "Google search title, <= ${SEO_TITLE_MAX} characters, main keyword first, no promo words",
  "seoDescription": "Meta description, <= ${SEO_DESC_MAX} characters, factual hook with real keywords",
  "keyFeatures": [
    "Benefit-led bullet grounded in a real given feature",
    "Second bullet (for apparel: fit/fabric; for electronics/other: a real spec or use-case)",
    "Third bullet from a real detail",
    "Fourth bullet from a real detail, care, or the sizes given"
  ],
  "keywords": ["6-8 real search keywords a buyer would type (include Hindi terms where natural)"],
  "meeshoListing": {
    "title": "Marketplace title <= ${MARKETPLACE_TITLE_MAX} chars: Brand + Model + Product type + up to 2 real key attributes. No promo words, no banned characters.",
    "description": "Factual catalog description: product type, material, colours, real features, and the sizes given. No invented specs or policies.",
    "category": "Best-fit marketplace category",
    "subcategory": "Specific subcategory"
  },
  "whatsappCaption": "4-6 short lines, minimal emoji, plain and warm. First line = product. Put ${PRICE_LINE_TOKEN} on its own line. No phone numbers or links.",
  "instagramCaption": "Short caption whose FIRST line is a plain, searchable description of the product, then 1-2 benefit lines. No price.",
  "instagramHashtags": ["exactly ${MAX_HASHTAGS} specific, relevant hashtags"]
}
`;

  return { systemPrompt, userContent };
}

/**
 * Turns the parsed LLM JSON into complete, valid IAiGeneratedText and enforces the guardrails in
 * code (prices, platform limits, banned title characters, hashtag cap, server-written contact).
 */
export function sanitizeListingText(parsed: any, params: GenerateTextParams): IAiGeneratedText {
  const hi = params.language === "hi";
  const fallback = generateFallbackListingText(params);
  const pricing = normalizePricing(params.price, params.discountPrice);
  const priceLine = buildPriceLine(pricing);
  const allowed = [pricing.mrp, pricing.selling].filter((n): n is number => n !== undefined);

  const hasBadAmount = (text: string) => findDisallowedAmounts(text, allowed).length > 0;
  const stripToken = (text: string) => text.split(PRICE_LINE_TOKEN).join("");
  const singleLine = <F extends string | undefined>(value: unknown, fb: F): string | F => {
    const text = typeof value === "string" ? stripToken(value).trim() : "";
    return text && !hasBadAmount(text) ? text : fb;
  };
  const multiLine = (value: unknown, fb: string) => {
    const text = typeof value === "string" ? stripToken(value) : "";
    const kept = text.split("\n").filter((line) => !hasBadAmount(line)).join("\n").trim();
    return kept || fb;
  };
  const tagList = (value: unknown, fb: string[]) => {
    const kept = Array.isArray(value) ? value.map(String).filter((t) => t.trim() && !hasBadAmount(t)) : [];
    return kept.length > 0 ? kept : fb;
  };

  // WhatsApp: the server, not the model, writes the price line and the contact line.
  const modelCaption: string | undefined = parsed.whatsappCaption?.trim();
  let whatsappCaption = fallback.whatsappCaption;
  if (modelCaption) {
    let lines = modelCaption.split("\n");
    if (modelCaption.includes(PRICE_LINE_TOKEN)) {
      lines = lines.flatMap((line) =>
        line.includes(PRICE_LINE_TOKEN) ? (priceLine ? [line.split(PRICE_LINE_TOKEN).join(priceLine)] : []) : [line]
      );
    } else if (priceLine) {
      lines.splice(1, 0, priceLine);
    }
    const contact = buildContactLine(params, hi);
    const body = lines
      .filter((line) => line === priceLine || (!hasBadAmount(line) && !URL_OR_PHONE.test(line)))
      .join("\n")
      .trim();
    whatsappCaption = (contact ? `${body}\n\n${contact}` : body) || fallback.whatsappCaption;
  }

  const keyFeatures: unknown[] =
    Array.isArray(parsed.keyFeatures) && parsed.keyFeatures.length > 0 ? parsed.keyFeatures : fallback.keyFeatures;

  const seoTitleRaw = singleLine(parsed.seoTitle, fallback.seoTitle);
  const marketTitleRaw = singleLine(parsed.meeshoListing?.title, fallback.meeshoListing.title);

  const hashtags = tagList(parsed.instagramHashtags, fallback.instagramHashtags)
    .map((t) => cleanHashtag(String(t)))
    .filter(Boolean)
    .slice(0, MAX_HASHTAGS);

  return {
    seoTitle: clampWords(stripPromo(seoTitleRaw), SEO_TITLE_MAX),
    seoDescription: clampWords(singleLine(parsed.seoDescription, fallback.seoDescription), SEO_DESC_MAX),
    keyFeatures: keyFeatures.map((feature, i) =>
      singleLine(feature, fallback.keyFeatures[i % fallback.keyFeatures.length]!)
    ),
    keywords: tagList(parsed.keywords, fallback.keywords),
    meeshoListing: {
      title: cleanMarketplaceTitle(marketTitleRaw),
      description: multiLine(parsed.meeshoListing?.description, fallback.meeshoListing.description),
      category: singleLine(parsed.meeshoListing?.category, fallback.meeshoListing.category),
      subcategory: singleLine(parsed.meeshoListing?.subcategory, fallback.meeshoListing.subcategory),
    },
    whatsappCaption,
    instagramCaption: multiLine(parsed.instagramCaption, fallback.instagramCaption),
    instagramHashtags: hashtags.length > 0 ? hashtags : fallback.instagramHashtags,
  };
}

function openAiKeyMissing(apiKey: string | undefined): boolean {
  return !apiKey || apiKey.includes("YOUR_OPENAI_API_KEY") || apiKey === "sk-mock-key";
}

/**
 * Direct non-streaming generation for BullMQ worker and tRPC self-healing.
 * Returns complete, valid IAiGeneratedText, or throws when OpenAI fails: the seller paid for
 * AI-written copy, so a failure fails the listing (and refunds it) instead of delivering
 * template text. Template text only with AI_OFFLINE_FALLBACK in local development.
 */
export async function generateListingText(params: GenerateTextParams): Promise<IAiGeneratedText> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (openAiKeyMissing(apiKey)) {
    if (aiOfflineFallbackAllowed()) return generateFallbackListingText(params);
    throw new Error("OpenAI is not configured (OPENAI_API_KEY)");
  }

  const { systemPrompt, userContent } = buildPrompts(params);

  const startTime = Date.now();
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const latencySeconds = (Date.now() - startTime) / 1000;
    const raw = response.choices[0]?.message?.content?.trim() || "";

    trackAIGeneration({
      provider: "openai",
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      output: raw,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      latencySeconds,
    });

    if (!raw) {
      throw new Error("OpenAI returned no listing text");
    }

    const parsed = JSON.parse(raw);

    // Sanitize, ensure no empty values, and enforce exact seller-entered prices
    return sanitizeListingText(parsed, params);
  } catch (error) {
    trackAIGeneration({
      provider: "openai",
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      output: "",
      latencySeconds: (Date.now() - startTime) / 1000,
      isError: true,
      errorMessage: String(error),
    });
    console.warn("[OpenAI Service] generateListingText failed:", error);
    if (aiOfflineFallbackAllowed()) return generateFallbackListingText(params);
    throw error;
  }
}

/**
 * Streaming version for real-time text streaming.
 */
export async function generateListingTextStream(
  params: GenerateTextParams,
  onChunk?: (chunk: { field: string; content: string }) => void
): Promise<IAiGeneratedText> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (openAiKeyMissing(apiKey)) {
    if (!aiOfflineFallbackAllowed()) throw new Error("OpenAI is not configured (OPENAI_API_KEY)");
    const fallback = generateFallbackListingText(params);
    if (onChunk) {
      onChunk({ field: "fallback", content: JSON.stringify(fallback) });
    }
    return fallback;
  }

  const { systemPrompt, userContent } = buildPrompts(params);

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      stream: true,
    });

    let fullText = "";

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullText += content;
        if (onChunk) {
          onChunk({ field: "stream", content });
        }
      }
    }

    const parsed = JSON.parse(fullText);
    return sanitizeListingText(parsed, params);
  } catch (error) {
    console.warn("[OpenAI Service] Streaming failed:", error);
    if (!aiOfflineFallbackAllowed()) throw error;
    const fallback = generateFallbackListingText(params);
    if (onChunk) {
      onChunk({ field: "fallback", content: JSON.stringify(fallback) });
    }
    return fallback;
  }
}
