// Browser-safe mirror of packages/services/card/card-design.ts (the source of truth); card-templates.test.ts checks parity.

export type TemplateId = string;

export type CardTemplateGroup = "everyday" | "offers" | "premium" | "festive";
export type CardTemplateLayout = "studio" | "bold" | "premium" | "utsav";

export interface CardTemplateInfo {
  id: TemplateId;
  group: CardTemplateGroup;
  layout: CardTemplateLayout;
  name: { en: string; hi: string };
  /** Thumbnail rendered by packages/services/scripts/render-card-previews.ts. */
  previewSrc: string;
}

const tpl = (
  id: string,
  layout: CardTemplateLayout,
  group: CardTemplateGroup,
  en: string,
  hi: string
): CardTemplateInfo => ({ id, layout, group, name: { en, hi }, previewSrc: `/card-previews/${id}.jpg` });

export const CARD_TEMPLATES_INFO: CardTemplateInfo[] = [
  tpl("studio-auto", "studio", "everyday", "Studio · Smart colour", "स्टूडियो · स्मार्ट रंग"),
  tpl("studio-terracotta", "studio", "everyday", "Studio · Terracotta", "स्टूडियो · टेराकोटा"),
  tpl("studio-haldi", "studio", "everyday", "Studio · Haldi", "स्टूडियो · हल्दी"),
  tpl("studio-peacock", "studio", "everyday", "Studio · Peacock", "स्टूडियो · मोरपंखी"),
  tpl("studio-indigo", "studio", "everyday", "Studio · Indigo", "स्टूडियो · नील"),
  tpl("studio-kumkum", "studio", "everyday", "Studio · Kumkum", "स्टूडियो · कुमकुम"),
  tpl("bold-terracotta", "bold", "offers", "Bazaar Offer · Terracotta", "बाज़ार ऑफ़र · टेराकोटा"),
  tpl("bold-haldi", "bold", "offers", "Bazaar Offer · Haldi", "बाज़ार ऑफ़र · हल्दी"),
  tpl("bold-peacock", "bold", "offers", "Bazaar Offer · Peacock", "बाज़ार ऑफ़र · मोरपंखी"),
  tpl("bold-indigo", "bold", "offers", "Bazaar Offer · Indigo", "बाज़ार ऑफ़र · नील"),
  tpl("bold-kumkum", "bold", "offers", "Bazaar Offer · Kumkum", "बाज़ार ऑफ़र · कुमकुम"),
  tpl("premium-noir", "premium", "premium", "Premium · Noir", "प्रीमियम · नॉयर"),
  tpl("premium-ivory", "premium", "premium", "Premium · Ivory", "प्रीमियम · आइवरी"),
  tpl("utsav-diwali", "utsav", "festive", "Diwali", "दीपावली"),
  tpl("utsav-dussehra", "utsav", "festive", "Dussehra", "दशहरा"),
  tpl("utsav-navratri", "utsav", "festive", "Navratri", "नवरात्रि"),
  tpl("utsav-durga-puja", "utsav", "festive", "Durga Puja", "दुर्गा पूजा"),
  tpl("utsav-holi", "utsav", "festive", "Holi", "होली"),
  tpl("utsav-eid", "utsav", "festive", "Eid", "ईद"),
  tpl("utsav-onam", "utsav", "festive", "Onam", "ओणम"),
  tpl("utsav-pongal", "utsav", "festive", "Pongal", "पोंगल"),
  tpl("utsav-rakhi", "utsav", "festive", "Raksha Bandhan", "रक्षाबंधन"),
  tpl("utsav-christmas", "utsav", "festive", "Christmas", "क्रिसमस"),
  tpl("utsav-wedding", "utsav", "festive", "Wedding Season", "शादी सीज़न"),
];

export const CARD_TEMPLATES_MAP: Record<TemplateId, CardTemplateInfo> = Object.fromEntries(
  CARD_TEMPLATES_INFO.map((t) => [t.id, t])
);

export const DEFAULT_TEMPLATE_ID: TemplateId = "studio-auto";

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

/** Maps any stored template ID (current, retired or unknown) to a current one, like resolveTemplate() on the server. */
export function resolveTemplateId(id: string | undefined | null): TemplateId {
  if (id && CARD_TEMPLATES_MAP[id]) return id;
  const mapped = id ? LEGACY_TEMPLATE_MAP[id] : undefined;
  return mapped && CARD_TEMPLATES_MAP[mapped] ? mapped : DEFAULT_TEMPLATE_ID;
}

export const CARD_TEMPLATE_GROUPS: { id: CardTemplateGroup; label: { en: string; hi: string } }[] = [
  { id: "everyday", label: { en: "Everyday", hi: "रोज़ाना" } },
  { id: "offers", label: { en: "Offers", hi: "ऑफ़र" } },
  { id: "premium", label: { en: "Premium", hi: "प्रीमियम" } },
  { id: "festive", label: { en: "Festive", hi: "त्योहार" } },
];
