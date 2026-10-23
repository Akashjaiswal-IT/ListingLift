/**
 * Design system for product cards: palettes, festivals, the template list,
 * card copy in English/Hindi, and the mapping from retired template IDs.
 */

export type CardLayout = "studio" | "bold" | "premium" | "utsav";
export type CardLanguage = "en" | "hi";

export type PaletteId = "terracotta" | "haldi" | "peacock" | "indigo" | "kumkum";

export interface Palette {
  /** Main brand colour of the card. */
  accent: string;
  /** Text drawn on top of `accent`. */
  onAccent: string;
  /** Deep shade for dark surfaces and headings. */
  deep: string;
  /** Very light tint used as a calm background. */
  tint: string;
  /** Body text on light surfaces. */
  ink: string;
  /** Secondary text on light surfaces. */
  muted: string;
  /** Hue in degrees, used to pick a palette that contrasts with the product. */
  hue: number;
}

// Warm Indian colours, each used as one calm solid field (no gradient stacks).
export const PALETTES: Record<PaletteId, Palette> = {
  terracotta: { accent: "#B5462A", onAccent: "#FFFFFF", deep: "#5E2414", tint: "#F6ECE4", ink: "#231A16", muted: "#7A6A61", hue: 12 },
  haldi: { accent: "#E0A21E", onAccent: "#2A1E05", deep: "#5A3F05", tint: "#FBF3DF", ink: "#2A2112", muted: "#7C6C4E", hue: 40 },
  peacock: { accent: "#0E7468", onAccent: "#FFFFFF", deep: "#083F39", tint: "#E3F1ED", ink: "#10241F", muted: "#5B716B", hue: 173 },
  indigo: { accent: "#3B3DA8", onAccent: "#FFFFFF", deep: "#1C1D57", tint: "#EAEAF6", ink: "#16172E", muted: "#646583", hue: 239 },
  kumkum: { accent: "#B01E35", onAccent: "#FFFFFF", deep: "#5A0D1A", tint: "#F8E6E8", ink: "#2A1015", muted: "#7E5D63", hue: 351 },
};

export type PremiumTone = "noir" | "ivory";

export const PREMIUM: Record<PremiumTone, { bg: string; ink: string; muted: string; gold: string; frame: string }> = {
  noir: { bg: "#141416", ink: "#F4EFE6", muted: "#A39E95", gold: "#C8A35A", frame: "#3A352C" },
  ivory: { bg: "#F2EBDF", ink: "#1D1A15", muted: "#6E665B", gold: "#9C7A3C", frame: "#D9CBB2" },
};

export type FestivalId =
  | "diwali"
  | "dussehra"
  | "navratri"
  | "durga-puja"
  | "holi"
  | "eid"
  | "onam"
  | "pongal"
  | "rakhi"
  | "christmas"
  | "wedding";

export interface Festival {
  name: { en: string; hi: string };
  greeting: { en: string; hi: string };
  /** Solid field colour of the card. */
  field: string;
  /** Text on the field. */
  ink: string;
  muted: string;
  /** Festive accent (border, chips, greeting). */
  accent: string;
  onAccent: string;
  /** Whether the field is dark (product sits in a white arch either way). */
  dark: boolean;
}

// One motif per festival, drawn in card-motifs.ts. Light and dark fields are mixed on purpose,
// and the set spans regions (Durga Puja, Onam, Pongal, Eid, Christmas), not only North India.
export const FESTIVALS: Record<FestivalId, Festival> = {
  diwali: { name: { en: "Diwali", hi: "दीपावली" }, greeting: { en: "Happy Diwali", hi: "शुभ दीपावली" }, field: "#3A0E12", ink: "#FBEFD9", muted: "#D9BFA0", accent: "#E8B04B", onAccent: "#2E0A0D", dark: true },
  dussehra: { name: { en: "Dussehra", hi: "दशहरा" }, greeting: { en: "Happy Dussehra", hi: "शुभ दशहरा" }, field: "#4A1B08", ink: "#FBEBD7", muted: "#DCB794", accent: "#F2A541", onAccent: "#3A1406", dark: true },
  navratri: { name: { en: "Navratri", hi: "नवरात्रि" }, greeting: { en: "Happy Navratri", hi: "शुभ नवरात्रि" }, field: "#4B0F52", ink: "#FBEAF6", muted: "#D9B3D4", accent: "#F4B63F", onAccent: "#3A0B40", dark: true },
  "durga-puja": { name: { en: "Durga Puja", hi: "दुर्गा पूजा" }, greeting: { en: "Shubho Durga Puja", hi: "शुभ दुर्गा पूजा" }, field: "#FBF6EE", ink: "#2A1210", muted: "#7A5A52", accent: "#B3121E", onAccent: "#FFFFFF", dark: false },
  holi: { name: { en: "Holi", hi: "होली" }, greeting: { en: "Happy Holi", hi: "होली की शुभकामनाएं" }, field: "#FFF7EE", ink: "#2A1A22", muted: "#7A6470", accent: "#D6337A", onAccent: "#FFFFFF", dark: false },
  eid: { name: { en: "Eid", hi: "ईद" }, greeting: { en: "Eid Mubarak", hi: "ईद मुबारक" }, field: "#0F3B37", ink: "#F1F5EC", muted: "#B4C9BF", accent: "#D9B35B", onAccent: "#0C2E2B", dark: true },
  onam: { name: { en: "Onam", hi: "ओणम" }, greeting: { en: "Happy Onam", hi: "ओणम की शुभकामनाएं" }, field: "#FBF4E3", ink: "#2A2010", muted: "#7A6A4C", accent: "#B8892B", onAccent: "#FFFFFF", dark: false },
  pongal: { name: { en: "Pongal", hi: "पोंगल" }, greeting: { en: "Happy Pongal", hi: "पोंगल की शुभकामनाएं" }, field: "#FFF4D8", ink: "#2B2008", muted: "#7C6A3E", accent: "#C2541E", onAccent: "#FFFFFF", dark: false },
  rakhi: { name: { en: "Raksha Bandhan", hi: "रक्षाबंधन" }, greeting: { en: "Happy Raksha Bandhan", hi: "रक्षाबंधन की शुभकामनाएं" }, field: "#FCECEF", ink: "#2C1218", muted: "#7E5E66", accent: "#C2185B", onAccent: "#FFFFFF", dark: false },
  christmas: { name: { en: "Christmas", hi: "क्रिसमस" }, greeting: { en: "Merry Christmas", hi: "मेरी क्रिसमस" }, field: "#12382A", ink: "#F3F1E8", muted: "#B8C7B8", accent: "#D9A441", onAccent: "#0E2B20", dark: true },
  wedding: { name: { en: "Wedding Season", hi: "शादी सीज़न" }, greeting: { en: "Wedding Season Special", hi: "शादी सीज़न स्पेशल" }, field: "#5C0E18", ink: "#FBECDD", muted: "#DDB9A6", accent: "#E2B35C", onAccent: "#3E0910", dark: true },
};

export type CardGroup = "everyday" | "offers" | "premium" | "festive";

export interface CardTemplate {
  id: string;
  layout: CardLayout;
  group: CardGroup;
  name: { en: string; hi: string };
  /** "auto" picks a palette that contrasts with the product's own colour. */
  palette?: PaletteId | "auto";
  premiumTone?: PremiumTone;
  festival?: FestivalId;
}

const PALETTE_NAMES: Record<PaletteId, { en: string; hi: string }> = {
  terracotta: { en: "Terracotta", hi: "टेराकोटा" },
  haldi: { en: "Haldi", hi: "हल्दी" },
  peacock: { en: "Peacock", hi: "मोरपंखी" },
  indigo: { en: "Indigo", hi: "नील" },
  kumkum: { en: "Kumkum", hi: "कुमकुम" },
};

const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

export const CARD_TEMPLATES: CardTemplate[] = [
  { id: "studio-auto", layout: "studio", group: "everyday", palette: "auto", name: { en: "Studio · Smart colour", hi: "स्टूडियो · स्मार्ट रंग" } },
  ...PALETTE_IDS.map((p): CardTemplate => ({
    id: `studio-${p}`,
    layout: "studio",
    group: "everyday",
    palette: p,
    name: { en: `Studio · ${PALETTE_NAMES[p].en}`, hi: `स्टूडियो · ${PALETTE_NAMES[p].hi}` },
  })),
  ...PALETTE_IDS.map((p): CardTemplate => ({
    id: `bold-${p}`,
    layout: "bold",
    group: "offers",
    palette: p,
    name: { en: `Bazaar Offer · ${PALETTE_NAMES[p].en}`, hi: `बाज़ार ऑफ़र · ${PALETTE_NAMES[p].hi}` },
  })),
  { id: "premium-noir", layout: "premium", group: "premium", premiumTone: "noir", name: { en: "Premium · Noir", hi: "प्रीमियम · नॉयर" } },
  { id: "premium-ivory", layout: "premium", group: "premium", premiumTone: "ivory", name: { en: "Premium · Ivory", hi: "प्रीमियम · आइवरी" } },
  ...(Object.keys(FESTIVALS) as FestivalId[]).map((f): CardTemplate => ({
    id: `utsav-${f}`,
    layout: "utsav",
    group: "festive",
    festival: f,
    name: { en: FESTIVALS[f].name.en, hi: FESTIVALS[f].name.hi },
  })),
];

export const DEFAULT_TEMPLATE_ID = "studio-auto";

// Retired 2025 templates → closest new template, so old listings keep regenerating cards.
export const LEGACY_TEMPLATE_MAP: Record<string, string> = {
  "minimal-luxury": "premium-noir",
  "midnight-gold": "premium-noir",
  "clean-modern": "studio-auto",
  "neon-cyber": "bold-indigo",
  "royal-emerald": "bold-peacock",
  "pastel-bloom": "studio-kumkum",
  "sunset-glow": "bold-terracotta",
  "nordic-slate": "premium-ivory",
  "festive-crimson": "bold-kumkum",
  "editorial-vogue": "premium-ivory",
  "navratri-garba-utsav": "utsav-navratri",
  "navratri-durga-shakti": "utsav-navratri",
  "navratri-mirror-kutch": "utsav-navratri",
  "navratri-dandiya-beats": "utsav-navratri",
  "navratri-chaniya-festive": "utsav-navratri",
  "navratri-navdurga-blessings": "utsav-navratri",
  "navratri-raas-leela": "utsav-navratri",
  "navratri-golden-thali": "utsav-navratri",
  "dussehra-golden-bow": "utsav-dussehra",
  "dussehra-victory-flame": "utsav-dussehra",
  "dussehra-royal-marigold": "utsav-dussehra",
  "dussehra-shubh-apta": "utsav-dussehra",
  "dussehra-ravan-dahan": "utsav-dussehra",
  "dussehra-shastra-puja": "utsav-dussehra",
  "dussehra-ayudha-utsav": "utsav-dussehra",
  "dussehra-vijaya-parv": "utsav-dussehra",
  "diwali-sacred-diya": "utsav-diwali",
  "diwali-rangoli-mandala": "utsav-diwali",
  "diwali-akash-kandil": "utsav-diwali",
  "diwali-royal-sparklers": "utsav-diwali",
  "diwali-dhamaka-gold": "utsav-diwali",
  "diwali-dhanteras-shubh": "utsav-diwali",
  "diwali-laxmi-puja": "utsav-diwali",
  "diwali-bhai-dooj": "utsav-diwali",
  "diwali-patakha-celebration": "utsav-diwali",
};

const TEMPLATE_BY_ID = new Map(CARD_TEMPLATES.map((t) => [t.id, t]));

/** Resolves any stored template ID (new, retired or unknown) to a current template. */
export function resolveTemplate(id: string | undefined | null): CardTemplate {
  const direct = id ? TEMPLATE_BY_ID.get(id) : undefined;
  if (direct) return direct;
  const mapped = id ? LEGACY_TEMPLATE_MAP[id] : undefined;
  return TEMPLATE_BY_ID.get(mapped || DEFAULT_TEMPLATE_ID)!;
}

/** Picks the palette whose hue is furthest from the product's, so the product stands out. */
export function pickPaletteForProduct(productHue: number | null): PaletteId {
  if (productHue === null) return "terracotta";
  let best: PaletteId = "terracotta";
  let bestDistance = -1;
  for (const id of PALETTE_IDS) {
    const d = Math.abs(((PALETTES[id].hue - productHue + 540) % 360) - 180);
    if (d > bestDistance) {
      bestDistance = d;
      best = id;
    }
  }
  return best;
}

export interface TrustBadges {
  cod?: boolean;
  freeDelivery?: boolean;
  easyReturns?: boolean;
  madeInIndia?: boolean;
}

export const COPY = {
  en: {
    mrp: "MRP",
    off: (pct: number) => `${pct}% OFF`,
    save: (amount: string) => `You save ${amount}`,
    orderOnWhatsapp: "Order on WhatsApp",
    trust: { cod: "Cash on Delivery", freeDelivery: "Free Delivery", easyReturns: "Easy Returns", madeInIndia: "Made in India" },
  },
  hi: {
    mrp: "MRP",
    off: (pct: number) => `${pct}% छूट`,
    save: (amount: string) => `${amount} की बचत`,
    orderOnWhatsapp: "WhatsApp पर ऑर्डर करें",
    trust: { cod: "कैश ऑन डिलीवरी", freeDelivery: "फ्री डिलीवरी", easyReturns: "आसान रिटर्न", madeInIndia: "मेड इन इंडिया" },
  },
} as const;

/** Formats Indian mobile numbers as "+91 98765 43210"; anything else is shown as entered. */
export function formatPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (local.length === 10) return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** Whole-percent discount from the seller's real MRP; null when there is no meaningful discount. */
export function discountPercent(mrp: number | undefined, selling: number | undefined): number | null {
  if (!mrp || !selling || selling >= mrp) return null;
  const pct = Math.floor(((mrp - selling) / mrp) * 100);
  return pct >= 5 ? pct : null;
}
