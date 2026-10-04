import sharp from "sharp";

export interface SellerInfo {
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  logoBuffer?: Buffer;
}

export type TemplateId =
  // Section 0: Luxury & High-End Studio (10 templates)
  | "minimal-luxury"
  | "midnight-gold"
  | "clean-modern"
  | "neon-cyber"
  | "royal-emerald"
  | "pastel-bloom"
  | "sunset-glow"
  | "nordic-slate"
  | "festive-crimson"
  | "editorial-vogue"
  // Section 1: Navratri Utsav (8 templates)
  | "navratri-garba-utsav"
  | "navratri-durga-shakti"
  | "navratri-mirror-kutch"
  | "navratri-dandiya-beats"
  | "navratri-chaniya-festive"
  | "navratri-navdurga-blessings"
  | "navratri-raas-leela"
  | "navratri-golden-thali"
  // Section 2: Dussehra & Vijayadashami (8 templates)
  | "dussehra-golden-bow"
  | "dussehra-victory-flame"
  | "dussehra-royal-marigold"
  | "dussehra-shubh-apta"
  | "dussehra-ravan-dahan"
  | "dussehra-shastra-puja"
  | "dussehra-ayudha-utsav"
  | "dussehra-vijaya-parv"
  // Section 3: Shubh Deepavali (9 templates)
  | "diwali-sacred-diya"
  | "diwali-rangoli-mandala"
  | "diwali-akash-kandil"
  | "diwali-royal-sparklers"
  | "diwali-dhamaka-gold"
  | "diwali-dhanteras-shubh"
  | "diwali-laxmi-puja"
  | "diwali-bhai-dooj"
  | "diwali-patakha-celebration";

export interface CardTemplateConfig {
  id: TemplateId;
  name: string;
  category: string;
  description: string;
  badge: string;
  bgGradStart: string;
  bgGradEnd: string;
  containerBg: string;
  containerText: string;
  priceColor: string;
  badgeBg: string;
  badgeText: string;
  ctaBg: string;
  ctaText: string;
  borderStroke: string;
  fontFamily: string;
  previewBg: string;
  isDark: boolean;
  festivalSection?: "navratri" | "dussehra" | "diwali" | "luxury";
  headline: string;
  tagline: string;
  archAccentColor?: string;
  podiumTopColor?: string;
  podiumBaseColor?: string;
}

export const CARD_TEMPLATES: Record<TemplateId, CardTemplateConfig> = {
  // ================= 10 LUXURY & HIGH-END STUDIO =================
  "minimal-luxury": {
    id: "minimal-luxury",
    name: "Luxury Minimalist",
    category: "High-End & Designer",
    festivalSection: "luxury",
    description: "Ivory tones, obsidian serif styling, and champagne gold accents",
    badge: "LUXE",
    bgGradStart: "#2A2521",
    bgGradEnd: "#14110F",
    containerBg: "#1F1B18",
    containerText: "#F8FAFC",
    priceColor: "#FDE047",
    badgeBg: "#D4AF37",
    badgeText: "#0F172A",
    ctaBg: "#D4AF37",
    ctaText: "#0F172A",
    borderStroke: "#D4AF37",
    fontFamily: "Georgia, serif",
    previewBg: "from-stone-900 to-amber-950",
    isDark: true,
    headline: "Exquisite Signature Edition",
    tagline: "Unmatched Craftsmanship & Timeless Luxury",
    archAccentColor: "#D4AF37",
  },
  "midnight-gold": {
    id: "midnight-gold",
    name: "Midnight Prestige",
    category: "Prestige & Premium",
    festivalSection: "luxury",
    description: "Deep obsidian gradient with metallic 24K gold foil badges",
    badge: "PRESTIGE",
    bgGradStart: "#0B0F19",
    bgGradEnd: "#1A1B35",
    containerBg: "#111827",
    containerText: "#F9FAFB",
    priceColor: "#FBBF24",
    badgeBg: "#3730A3",
    badgeText: "#FCD34D",
    ctaBg: "#F59E0B",
    ctaText: "#0F172A",
    borderStroke: "#D97706",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-slate-950 via-indigo-950 to-slate-900",
    isDark: true,
    headline: "The Royal Midnight Collection",
    tagline: "Curated Excellence for the Discerning Buyer",
    archAccentColor: "#F59E0B",
  },
  "clean-modern": {
    id: "clean-modern",
    name: "Studio Clean White",
    category: "Tech & Lifestyle",
    festivalSection: "luxury",
    description: "Crisp white studio layout with electric indigo focus",
    badge: "MODERN",
    bgGradStart: "#1E1B4B",
    bgGradEnd: "#0F172A",
    containerBg: "#1E293B",
    containerText: "#FFFFFF",
    priceColor: "#60A5FA",
    badgeBg: "#4338CA",
    badgeText: "#FFFFFF",
    ctaBg: "#4F46E5",
    ctaText: "#FFFFFF",
    borderStroke: "#6366F1",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-indigo-950 via-slate-900 to-slate-950",
    isDark: true,
    headline: "Studio Showcase Special",
    tagline: "Minimalist Perfection Meets Pure Performance",
    archAccentColor: "#818CF8",
  },
  "neon-cyber": {
    id: "neon-cyber",
    name: "Neon Cyber Sale",
    category: "Streetwear & Flash Deals",
    festivalSection: "luxury",
    description: "Electric cyan and hot magenta cyber aesthetic for high-impact drops",
    badge: "FLASH SALE",
    bgGradStart: "#09090B",
    bgGradEnd: "#18181B",
    containerBg: "#121217",
    containerText: "#FFFFFF",
    priceColor: "#06B6D4",
    badgeBg: "#BE123C",
    badgeText: "#FFE4E6",
    ctaBg: "#06B6D4",
    ctaText: "#000000",
    borderStroke: "#06B6D4",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-black via-zinc-900 to-cyan-950",
    isDark: true,
    headline: "Limited Drop • Exclusive Release",
    tagline: "Next-Gen Futuristic Design & Premium Build",
    archAccentColor: "#06B6D4",
  },
  "royal-emerald": {
    id: "royal-emerald",
    name: "Royal Emerald",
    category: "Heritage & Traditional",
    festivalSection: "luxury",
    description: "Deep forest emerald backdrop with opulent brass gold trim",
    badge: "HERITAGE",
    bgGradStart: "#022C22",
    bgGradEnd: "#064E3B",
    containerBg: "#064E3B",
    containerText: "#ECFDF5",
    priceColor: "#FDE047",
    badgeBg: "#047857",
    badgeText: "#FCD34D",
    ctaBg: "#F59E0B",
    ctaText: "#022C22",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-emerald-950 via-teal-950 to-emerald-900",
    isDark: true,
    headline: "Imperial Royal Heritage",
    tagline: "Timeless Elegance Infused with Regal Grandeur",
    archAccentColor: "#FDE047",
  },
  "pastel-bloom": {
    id: "pastel-bloom",
    name: "Soft Pastel Chic",
    category: "Beauty & Fashion",
    festivalSection: "luxury",
    description: "Delicate blush and rose gold tones with soft organic curves",
    badge: "TRENDING",
    bgGradStart: "#4C0519",
    bgGradEnd: "#881337",
    containerBg: "#9F1239",
    containerText: "#FFF1F2",
    priceColor: "#FECDD3",
    badgeBg: "#BE123C",
    badgeText: "#FFE4E6",
    ctaBg: "#FB7185",
    ctaText: "#4C0519",
    borderStroke: "#FB7185",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-rose-950 via-pink-950 to-red-950",
    isDark: true,
    headline: "Trending Chic Collection",
    tagline: "Effortless Grace for Every Occasion",
    archAccentColor: "#FDA4AF",
  },
  "sunset-glow": {
    id: "sunset-glow",
    name: "Sunset Radiance",
    category: "Summer & Activewear",
    festivalSection: "luxury",
    description: "Blazing amber to magenta sunset energy with high-contrast text",
    badge: "HOT DEAL",
    bgGradStart: "#2A0845",
    bgGradEnd: "#641530",
    containerBg: "#1C0A26",
    containerText: "#FFFFFF",
    priceColor: "#FB923C",
    badgeBg: "#C2410C",
    badgeText: "#FFEDD5",
    ctaBg: "#EA580C",
    ctaText: "#FFFFFF",
    borderStroke: "#EA580C",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-purple-950 via-orange-950 to-amber-950",
    isDark: true,
    headline: "Sunset Radiance Drop",
    tagline: "Vibrant Energy & High-Performance Design",
    archAccentColor: "#F97316",
  },
  "nordic-slate": {
    id: "nordic-slate",
    name: "Nordic Minimalist",
    category: "Industrial & Minimal",
    festivalSection: "luxury",
    description: "Muted charcoal and brushed steel with Swiss typographic precision",
    badge: "STUDIO",
    bgGradStart: "#0F172A",
    bgGradEnd: "#1E293B",
    containerBg: "#1E293B",
    containerText: "#F8FAFC",
    priceColor: "#38BDF8",
    badgeBg: "#334155",
    badgeText: "#CBD5E1",
    ctaBg: "#38BDF8",
    ctaText: "#0F172A",
    borderStroke: "#475569",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-slate-900 to-zinc-900",
    isDark: true,
    headline: "Nordic Minimalist Series",
    tagline: "Understated Precision & Functional Beauty",
    archAccentColor: "#38BDF8",
  },
  "festive-crimson": {
    id: "festive-crimson",
    name: "Festive Crimson",
    category: "Festive & Wedding",
    festivalSection: "luxury",
    description: "Regal ruby crimson with celebratory marigold yellow flourishes",
    badge: "CELEBRATION",
    bgGradStart: "#450A0A",
    bgGradEnd: "#7F1D1D",
    containerBg: "#5A0E17",
    containerText: "#FEF2F2",
    priceColor: "#FDE047",
    badgeBg: "#831843",
    badgeText: "#FDE047",
    ctaBg: "#EAB308",
    ctaText: "#450A0A",
    borderStroke: "#DC2626",
    fontFamily: "Georgia, serif",
    previewBg: "from-red-950 via-rose-950 to-red-900",
    isDark: true,
    headline: "Royal Festive Celebration",
    tagline: "Tradition Meets Opulence for Grand Moments",
    archAccentColor: "#FDE047",
  },
  "editorial-vogue": {
    id: "editorial-vogue",
    name: "Editorial Vogue",
    category: "Couture & Editorial",
    festivalSection: "luxury",
    description: "High-contrast monochrome couture layout with vivid scarlet accents",
    badge: "LIMITED EDIT",
    bgGradStart: "#18181B",
    bgGradEnd: "#09090B",
    containerBg: "#09090B",
    containerText: "#FFFFFF",
    priceColor: "#EF4444",
    badgeBg: "#DC2626",
    badgeText: "#FFFFFF",
    ctaBg: "#EF4444",
    ctaText: "#FFFFFF",
    borderStroke: "#EF4444",
    fontFamily: "Georgia, serif",
    previewBg: "from-zinc-950 to-neutral-900",
    isDark: true,
    headline: "Editorial Vogue Collection",
    tagline: "Runway-Inspired Silhouette & Striking Detail",
    archAccentColor: "#EF4444",
  },

  // ================= SECTION 1: NAVRATRI UTSAV (8 TEMPLATES) =================
  "navratri-garba-utsav": {
    id: "navratri-garba-utsav",
    name: "Garba Dandiya Night",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Vibrant Gujarati garba night theme with crossed dandiya sticks & swirling mandalas",
    badge: "NAVRATRI UTSAV",
    bgGradStart: "#1E0533",
    bgGradEnd: "#3D0C5A",
    containerBg: "#170428",
    containerText: "#FDF4FF",
    priceColor: "#FBBF24",
    badgeBg: "#831843",
    badgeText: "#FDE047",
    ctaBg: "#DB2777",
    ctaText: "#FFFFFF",
    borderStroke: "#EC4899",
    fontFamily: "Georgia, serif",
    previewBg: "from-fuchsia-950 via-purple-950 to-slate-950",
    isDark: true,
    headline: "Navratri Garba Special Offer!",
    tagline: "Celebrate 9 Nights of Joy & Divine Beats!",
    archAccentColor: "#F43F5E",
  },
  "navratri-durga-shakti": {
    id: "navratri-durga-shakti",
    name: "Durga Puja Shakti",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Sacred imperial vermilion & 24K gold with divine lotus and trishul aura",
    badge: "DURGA PUJA",
    bgGradStart: "#450A0A",
    bgGradEnd: "#781010",
    containerBg: "#2B0505",
    containerText: "#FFF7ED",
    priceColor: "#FDE047",
    badgeBg: "#B45309",
    badgeText: "#FEF3C7",
    ctaBg: "#F59E0B",
    ctaText: "#450A0A",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-rose-950 via-red-950 to-amber-950",
    isDark: true,
    headline: "Durga Puja Divine Blessings!",
    tagline: "Embrace Celestial Power, Grace & Elegance!",
    archAccentColor: "#F59E0B",
  },
  "navratri-mirror-kutch": {
    id: "navratri-mirror-kutch",
    name: "Kutch Mirror Work",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Traditional Gujarati ethnic diamond mirror embroidery and bandhani motifs",
    badge: "ETHNIC KUTCH",
    bgGradStart: "#081B2B",
    bgGradEnd: "#0D2E49",
    containerBg: "#061320",
    containerText: "#ECFEFF",
    priceColor: "#38BDF8",
    badgeBg: "#0E7490",
    badgeText: "#CFFAFE",
    ctaBg: "#06B6D4",
    ctaText: "#081B2B",
    borderStroke: "#22D3EE",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-slate-950 via-indigo-950 to-cyan-950",
    isDark: true,
    headline: "Kutch Mirror Work Festive Sale!",
    tagline: "Authentic Gujarati Artistry for the Festive Season!",
    archAccentColor: "#22D3EE",
  },
  "navratri-dandiya-beats": {
    id: "navratri-dandiya-beats",
    name: "Dandiya Raas Beats",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Royal peacock teal backdrop with carved dandiya celebration banners",
    badge: "RAAS DANDIYA",
    bgGradStart: "#022C22",
    bgGradEnd: "#064E3B",
    containerBg: "#02221A",
    containerText: "#F0FDF4",
    priceColor: "#FDE047",
    badgeBg: "#047857",
    badgeText: "#FCD34D",
    ctaBg: "#10B981",
    ctaText: "#022C22",
    borderStroke: "#34D399",
    fontFamily: "Georgia, serif",
    previewBg: "from-teal-950 via-emerald-950 to-slate-950",
    isDark: true,
    headline: "Dandiya Raas Special Celebration!",
    tagline: "Dance to the Rhythm of Navratri with Style!",
    archAccentColor: "#10B981",
  },
  "navratri-chaniya-festive": {
    id: "navratri-chaniya-festive",
    name: "Navratri Chaniya Luxe",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Regal Gujarati festive archway with hanging latkan tassels & celebratory gold",
    badge: "FESTIVE GLAM",
    bgGradStart: "#3A1207",
    bgGradEnd: "#6C240E",
    containerBg: "#240B04",
    containerText: "#FFF7ED",
    priceColor: "#FBBF24",
    badgeBg: "#C2410C",
    badgeText: "#FFEDD5",
    ctaBg: "#EA580C",
    ctaText: "#FFFFFF",
    borderStroke: "#FB923C",
    fontFamily: "Georgia, serif",
    previewBg: "from-orange-950 via-red-950 to-neutral-950",
    isDark: true,
    headline: "Chaniya Choli Festive Glamour!",
    tagline: "Dazzle the Festivities with Opulent Design!",
    archAccentColor: "#FB923C",
  },
  "navratri-navdurga-blessings": {
    id: "navratri-navdurga-blessings",
    name: "Navdurga Divine Blessings",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Nine forms of Durga sacred aura with imperial saffron & radiating golden halos",
    badge: "NAVDURGA",
    bgGradStart: "#2B0404",
    bgGradEnd: "#5E0909",
    containerBg: "#1F0303",
    containerText: "#FFF7ED",
    priceColor: "#FDE047",
    badgeBg: "#B45309",
    badgeText: "#FEF3C7",
    ctaBg: "#F59E0B",
    ctaText: "#1F0303",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-red-950 via-amber-950 to-orange-950",
    isDark: true,
    headline: "Navdurga Divine Grace Offer!",
    tagline: "Blessed with Prosperity, Health & Happiness!",
    archAccentColor: "#FDE047",
  },
  "navratri-raas-leela": {
    id: "navratri-raas-leela",
    name: "Midnight Raas Leela",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Midnight indigo with celestial moonlight and golden Krishna flute raas motifs",
    badge: "RAAS LEELA",
    bgGradStart: "#0B0C26",
    bgGradEnd: "#1A1B4B",
    containerBg: "#060718",
    containerText: "#EEF2FF",
    priceColor: "#FDE047",
    badgeBg: "#3730A3",
    badgeText: "#FDE047",
    ctaBg: "#6366F1",
    ctaText: "#FFFFFF",
    borderStroke: "#818CF8",
    fontFamily: "Georgia, serif",
    previewBg: "from-indigo-950 via-purple-950 to-blue-950",
    isDark: true,
    headline: "Sharad Poornima Raas Special!",
    tagline: "Bathed in Moonlit Melody & Festive Harmony!",
    archAccentColor: "#818CF8",
  },
  "navratri-golden-thali": {
    id: "navratri-golden-thali",
    name: "Puja Thali Auspicious",
    category: "Navratri Special",
    festivalSection: "navratri",
    description: "Auspicious brass puja thali with kumkum, akshat, and sacred temple bells",
    badge: "SHUBH PUJA",
    bgGradStart: "#2E1A04",
    bgGradEnd: "#5E3608",
    containerBg: "#1C1002",
    containerText: "#FFFBEB",
    priceColor: "#FDE047",
    badgeBg: "#B45309",
    badgeText: "#FEF3C7",
    ctaBg: "#D97706",
    ctaText: "#1C1002",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-amber-950 via-yellow-950 to-stone-950",
    isDark: true,
    headline: "Shubh Navratri Puja Special!",
    tagline: "Sacred Traditions, Golden Blessings & Joy!",
    archAccentColor: "#FDE047",
  },

  // ================= SECTION 2: DUSSEHRA & VIJAYADASHAMI (8 TEMPLATES) =================
  "dussehra-golden-bow": {
    id: "dussehra-golden-bow",
    name: "Vijay Dhanush Bow",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Majestic golden bow and drawn arrow vector symbolizing victory of good over evil",
    badge: "VIJAYADASHAMI",
    bgGradStart: "#0B1528",
    bgGradEnd: "#16284D",
    containerBg: "#080F1E",
    containerText: "#EFF6FF",
    priceColor: "#FBBF24",
    badgeBg: "#1E3A8A",
    badgeText: "#FDE047",
    ctaBg: "#F59E0B",
    ctaText: "#0B1528",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-slate-950 via-blue-950 to-indigo-950",
    isDark: true,
    headline: "Vijay Dhanush Victory Offer!",
    tagline: "Celebrate the Triumph of Good over Evil!",
    archAccentColor: "#F59E0B",
  },
  "dussehra-victory-flame": {
    id: "dussehra-victory-flame",
    name: "Victory Agni Flame",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Sacred victory bonfire flame motif with ascending radiant golden embers",
    badge: "VICTORY FLAME",
    bgGradStart: "#380D0D",
    bgGradEnd: "#601414",
    containerBg: "#220808",
    containerText: "#FEF2F2",
    priceColor: "#FDE047",
    badgeBg: "#991B1B",
    badgeText: "#FEF08A",
    ctaBg: "#DC2626",
    ctaText: "#FFFFFF",
    borderStroke: "#EF4444",
    fontFamily: "Georgia, serif",
    previewBg: "from-red-950 via-orange-950 to-amber-950",
    isDark: true,
    headline: "Vijay Agni Victory Flame Special!",
    tagline: "Ignite Your Life with Courage & Success!",
    archAccentColor: "#EF4444",
  },
  "dussehra-royal-marigold": {
    id: "dussehra-royal-marigold",
    name: "Auspicious Marigold Toran",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Auspicious orange and yellow fresh marigold flower garland draped along top arch",
    badge: "SHUBH DUSSEHRA",
    bgGradStart: "#062B21",
    bgGradEnd: "#0E4838",
    containerBg: "#041F17",
    containerText: "#ECFDF5",
    priceColor: "#FDE047",
    badgeBg: "#A16207",
    badgeText: "#FEF08A",
    ctaBg: "#EAB308",
    ctaText: "#062B21",
    borderStroke: "#FACC15",
    fontFamily: "Georgia, serif",
    previewBg: "from-emerald-950 via-teal-950 to-slate-950",
    isDark: true,
    headline: "Auspicious Marigold Festive Offer!",
    tagline: "Welcome Golden Prosperity at Your Doorstep!",
    archAccentColor: "#FACC15",
  },
  "dussehra-shubh-apta": {
    id: "dussehra-shubh-apta",
    name: "Golden Apta Leaves",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Sacred golden Apta leaves silhouette with blessings of fortune and prosperity",
    badge: "APTA BLESSINGS",
    bgGradStart: "#1B0F2E",
    bgGradEnd: "#331C57",
    containerBg: "#120A20",
    containerText: "#FAF5FF",
    priceColor: "#FDE047",
    badgeBg: "#581C87",
    badgeText: "#FDE047",
    ctaBg: "#D97706",
    ctaText: "#FFFFFF",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-purple-950 via-violet-950 to-slate-950",
    isDark: true,
    headline: "Golden Apta Blessings Offer!",
    tagline: "Share the Gold of Fortune & Good Luck!",
    archAccentColor: "#FDE047",
  },
  "dussehra-ravan-dahan": {
    id: "dussehra-ravan-dahan",
    name: "Triumphant Victory",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Heroic victory fortress archway with celestial sparkbursts celebrating triumph",
    badge: "TRIUMPH SALE",
    bgGradStart: "#261304",
    bgGradEnd: "#4D2608",
    containerBg: "#190C03",
    containerText: "#FFFBEB",
    priceColor: "#FBBF24",
    badgeBg: "#B45309",
    badgeText: "#FEF3C7",
    ctaBg: "#EA580C",
    ctaText: "#FFFFFF",
    borderStroke: "#F97316",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-stone-950 via-amber-950 to-orange-950",
    isDark: true,
    headline: "Triumphant Victory Flash Sale!",
    tagline: "Rise Victorious with Unmatched Quality & Deals!",
    archAccentColor: "#F97316",
  },
  "dussehra-shastra-puja": {
    id: "dussehra-shastra-puja",
    name: "Shastra Puja Honour",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Royal Rajputana shastra puja crest with crossed ceremonial golden swords & shield",
    badge: "SHASTRA PUJA",
    bgGradStart: "#1E0E08",
    bgGradEnd: "#431E12",
    containerBg: "#140905",
    containerText: "#FFF7ED",
    priceColor: "#FDE047",
    badgeBg: "#9A3412",
    badgeText: "#FED7AA",
    ctaBg: "#EA580C",
    ctaText: "#140905",
    borderStroke: "#F97316",
    fontFamily: "Georgia, serif",
    previewBg: "from-stone-950 via-red-950 to-amber-950",
    isDark: true,
    headline: "Royal Shastra Puja Honour!",
    tagline: "Saluting Mastery, Strength & Regal Craft!",
    archAccentColor: "#FDE047",
  },
  "dussehra-ayudha-utsav": {
    id: "dussehra-ayudha-utsav",
    name: "Ayudha Puja Craft",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Divine artisan implements and craft celebration with auspicious brass lamps",
    badge: "AYUDHA PUJA",
    bgGradStart: "#0B1D28",
    bgGradEnd: "#14374D",
    containerBg: "#07131B",
    containerText: "#F0F9FF",
    priceColor: "#38BDF8",
    badgeBg: "#0369A1",
    badgeText: "#BAE6FD",
    ctaBg: "#0284C7",
    ctaText: "#F0F9FF",
    borderStroke: "#38BDF8",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-sky-950 via-slate-950 to-cyan-950",
    isDark: true,
    headline: "Ayudha Puja Craftsmanship Special!",
    tagline: "Honouring the Sacred Tools of Precision & Art!",
    archAccentColor: "#38BDF8",
  },
  "dussehra-vijaya-parv": {
    id: "dussehra-vijaya-parv",
    name: "Vijaya Parv Grand",
    category: "Dussehra Special",
    festivalSection: "dussehra",
    description: "Golden victory chariot & sun wheel rays with royal heraldic celebration banner",
    badge: "VIJAYA PARV",
    bgGradStart: "#2E1503",
    bgGradEnd: "#5B2A06",
    containerBg: "#1C0D02",
    containerText: "#FFFBEB",
    priceColor: "#FDE047",
    badgeBg: "#B45309",
    badgeText: "#FEF3C7",
    ctaBg: "#F59E0B",
    ctaText: "#1C0D02",
    borderStroke: "#FBBF24",
    fontFamily: "Georgia, serif",
    previewBg: "from-amber-950 via-orange-950 to-yellow-950",
    isDark: true,
    headline: "Grand Vijayadashami Celebration!",
    tagline: "Step Forward in Glory with Auspicious Blessings!",
    archAccentColor: "#FDE047",
  },

  // ================= SECTION 3: SHUBH DEEPAVALI (9 TEMPLATES) =================
  "diwali-sacred-diya": {
    id: "diwali-sacred-diya",
    name: "Glowing Sacred Diya",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Handcrafted terracotta oil diya with flickering golden flame and warm contact aura",
    badge: "SHUBH DEEPAVALI",
    bgGradStart: "#2B0505",
    bgGradEnd: "#520B0B",
    containerBg: "#190303",
    containerText: "#FFF7ED",
    priceColor: "#FDE047",
    badgeBg: "#991B1B",
    badgeText: "#FEF08A",
    ctaBg: "#F59E0B",
    ctaText: "#2B0505",
    borderStroke: "#FBBF24",
    fontFamily: "Georgia, serif",
    previewBg: "from-rose-950 via-red-950 to-neutral-950",
    isDark: true,
    headline: "Diwali Special Offer!",
    tagline: "Light Up Your Festive Days with This Premium Collection!",
    archAccentColor: "#FDE047",
  },
  "diwali-rangoli-mandala": {
    id: "diwali-rangoli-mandala",
    name: "Imperial Rangoli Mandala",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Sacred radial 12-petaled Rangoli mandala overlay in pure 24K gold filigree lines",
    badge: "FESTIVE RANGOLI",
    bgGradStart: "#0B0E17",
    bgGradEnd: "#161C2E",
    containerBg: "#07090F",
    containerText: "#F8FAFC",
    priceColor: "#FDE047",
    badgeBg: "#1E293B",
    badgeText: "#FDE047",
    ctaBg: "#D4AF37",
    ctaText: "#0B0E17",
    borderStroke: "#EAB308",
    fontFamily: "Georgia, serif",
    previewBg: "from-slate-950 via-indigo-950 to-neutral-950",
    isDark: true,
    headline: "Shubh Rangoli Festive Offer!",
    tagline: "Adorn Your Home with Auspicious 24K Harmony!",
    archAccentColor: "#EAB308",
  },
  "diwali-akash-kandil": {
    id: "diwali-akash-kandil",
    name: "Festival Akash Kandil",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Traditional hanging Indian paper lantern with flowing decorative festival tails",
    badge: "LANTERN FEST",
    bgGradStart: "#1E0B2B",
    bgGradEnd: "#3C1754",
    containerBg: "#12061A",
    containerText: "#FAF5FF",
    priceColor: "#F472B6",
    badgeBg: "#701A75",
    badgeText: "#FDF4FF",
    ctaBg: "#E11D48",
    ctaText: "#FFFFFF",
    borderStroke: "#F43F5E",
    fontFamily: "Georgia, serif",
    previewBg: "from-purple-950 via-rose-950 to-slate-950",
    isDark: true,
    headline: "Akash Kandil Festival of Lights!",
    tagline: "Brighten Every Corner with Glowing Cheer!",
    archAccentColor: "#F43F5E",
  },
  "diwali-royal-sparklers": {
    id: "diwali-royal-sparklers",
    name: "Celestial Fireworks Sparkler",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Radiating golden sparkler fireworks & celestial stardust particles on midnight velvet",
    badge: "CELESTIAL SPARK",
    bgGradStart: "#030712",
    bgGradEnd: "#111827",
    containerBg: "#02040A",
    containerText: "#F9FAFB",
    priceColor: "#FDE047",
    badgeBg: "#1F2937",
    badgeText: "#FDE047",
    ctaBg: "#FACC15",
    ctaText: "#030712",
    borderStroke: "#FDE047",
    fontFamily: "Georgia, serif",
    previewBg: "from-black via-zinc-950 to-slate-950",
    isDark: true,
    headline: "Golden Sparklers Festive Drop!",
    tagline: "Sparkle with Starlight Radiance This Season!",
    archAccentColor: "#FDE047",
  },
  "diwali-dhamaka-gold": {
    id: "diwali-dhamaka-gold",
    name: "Grand Diwali Dhamaka",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Grand festival sale starburst seal flanked by twin burning brass oil lamps",
    badge: "DIWALI DHAMAKA",
    bgGradStart: "#1E0505",
    bgGradEnd: "#3D0E02",
    containerBg: "#140301",
    containerText: "#FFFBEB",
    priceColor: "#FDE047",
    badgeBg: "#DC2626",
    badgeText: "#FFFFFF",
    ctaBg: "#F59E0B",
    ctaText: "#000000",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-amber-950 via-yellow-950/80 to-black",
    isDark: true,
    headline: "Grand Diwali Dhamaka Offer!",
    tagline: "Explosive Savings & Unmatched Festive Luxury!",
    archAccentColor: "#F59E0B",
  },
  "diwali-dhanteras-shubh": {
    id: "diwali-dhanteras-shubh",
    name: "Shubh Dhanteras Kalash",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Sacred overflowing golden Kalash pot with spilling 24K gold coins and pure silver diyas",
    badge: "DHANTERAS",
    bgGradStart: "#2E1C03",
    bgGradEnd: "#5E3906",
    containerBg: "#1F1202",
    containerText: "#FFFBEB",
    priceColor: "#FDE047",
    badgeBg: "#D97706",
    badgeText: "#FEF3C7",
    ctaBg: "#F59E0B",
    ctaText: "#1F1202",
    borderStroke: "#FDE047",
    fontFamily: "Georgia, serif",
    previewBg: "from-amber-950 via-yellow-950 to-neutral-950",
    isDark: true,
    headline: "Dhanteras Shubh Labh Special!",
    tagline: "Multiply Wealth, Prosperity & Golden Joy!",
    archAccentColor: "#FDE047",
  },
  "diwali-laxmi-puja": {
    id: "diwali-laxmi-puja",
    name: "Laxmi Puja Divine",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Sacred pink lotus blossoms, Shubh Labh insignias & shimmering golden prosperity coins",
    badge: "LAXMI PUJA",
    bgGradStart: "#2B0515",
    bgGradEnd: "#520A2A",
    containerBg: "#1C030E",
    containerText: "#FCE7F3",
    priceColor: "#FDE047",
    badgeBg: "#BE185D",
    badgeText: "#FDF2F8",
    ctaBg: "#EC4899",
    ctaText: "#FFFFFF",
    borderStroke: "#F472B6",
    fontFamily: "Georgia, serif",
    previewBg: "from-pink-950 via-rose-950 to-neutral-950",
    isDark: true,
    headline: "Laxmi Puja Divine Prosperity Sale!",
    tagline: "Embrace Abundance & Joy with Sacred Quality!",
    archAccentColor: "#F472B6",
  },
  "diwali-bhai-dooj": {
    id: "diwali-bhai-dooj",
    name: "Bhai Dooj Festive Love",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Sacred Roli-Tikka emblem with festive mithai garland, floral arch & celebratory lanterns",
    badge: "BHAI DOOJ",
    bgGradStart: "#2B0609",
    bgGradEnd: "#520C12",
    containerBg: "#1C0406",
    containerText: "#FEE2E2",
    priceColor: "#FDE047",
    badgeBg: "#B91C1C",
    badgeText: "#FEF2F2",
    ctaBg: "#EF4444",
    ctaText: "#FFFFFF",
    borderStroke: "#F87171",
    fontFamily: "Georgia, serif",
    previewBg: "from-red-950 via-rose-950 to-neutral-950",
    isDark: true,
    headline: "Bhai Dooj Special Gift Box!",
    tagline: "The Perfect Gift to Celebrate Everlasting Bonds!",
    archAccentColor: "#F87171",
  },
  "diwali-patakha-celebration": {
    id: "diwali-patakha-celebration",
    name: "Festive Joy Fireworks",
    category: "Diwali Special",
    festivalSection: "diwali",
    description: "Vibrant phuljhadi sparkler bursts, festive chakra spinners, golden floor lights & royal celebration stage",
    badge: "FESTIVE LIGHTS",
    bgGradStart: "#1E0616",
    bgGradEnd: "#3D0C2C",
    containerBg: "#14040F",
    containerText: "#FDF4FF",
    priceColor: "#FDE047",
    badgeBg: "#A21CAF",
    badgeText: "#FAE8FF",
    ctaBg: "#D946EF",
    ctaText: "#FFFFFF",
    borderStroke: "#E879F9",
    fontFamily: "Georgia, serif",
    previewBg: "from-fuchsia-950 via-purple-950 to-neutral-950",
    isDark: true,
    headline: "Diwali Lights Celebration Special!",
    tagline: "Spread Light & Joy This Festive Season!",
    archAccentColor: "#E879F9",
  },
};

export const TEMPLATE_LIST = Object.values(CARD_TEMPLATES);

export interface CardRenderParams {
  productImage?: Buffer;
  productImageBuffer?: Buffer;
  productTitle?: string;
  title?: string;
  price?: number;
  discountPrice?: number;
  ctaText?: string;
  templateId?: string;
  sellerInfo?: SellerInfo;
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
}

export interface RenderedCards {
  whatsappCard: Buffer;
  whatsapp: Buffer;
  instagramPost: Buffer;
  instagramStory: Buffer;
}

/**
 * Returns authored vector embellishments tailored to the specific template and layout
 */
function getFestivalVectorEmbellishment(
  templateId: TemplateId,
  width: number,
  height: number,
  layout: "wa" | "ig" | "story"
): string {
  switch (templateId) {
    // 1. Garba Dandiya Night
    case "navratri-garba-utsav":
    case "navratri-dandiya-beats": {
      const stickX = layout === "story" ? width - 110 : width - 130;
      const stickY = layout === "story" ? 220 : 160;
      return `
        <!-- Crossed Dandiya Sticks Motif -->
        <g transform="translate(${stickX}, ${stickY}) scale(0.85)">
          <g transform="rotate(35)">
            <rect x="-7" y="-60" width="14" height="120" rx="7" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>
            <rect x="-7" y="-40" width="14" height="10" fill="#EC4899"/>
            <rect x="-7" y="-18" width="14" height="10" fill="#8B5CF6"/>
            <rect x="-7" y="4" width="14" height="10" fill="#10B981"/>
            <circle cx="0" cy="-52" r="5" fill="#FDE047"/>
            <circle cx="0" cy="52" r="5" fill="#FDE047"/>
          </g>
          <g transform="rotate(-35)">
            <rect x="-7" y="-60" width="14" height="120" rx="7" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>
            <rect x="-7" y="-40" width="14" height="10" fill="#10B981"/>
            <rect x="-7" y="-18" width="14" height="10" fill="#8B5CF6"/>
            <rect x="-7" y="4" width="14" height="10" fill="#EC4899"/>
            <circle cx="0" cy="-52" r="5" fill="#FDE047"/>
            <circle cx="0" cy="52" r="5" fill="#FDE047"/>
          </g>
          <circle cx="0" cy="0" r="9" fill="#F43F5E" stroke="#FDE047" stroke-width="2"/>
        </g>
      `;
    }

    // 2. Durga Puja Shakti & Navdurga
    case "navratri-durga-shakti":
    case "navratri-navdurga-blessings": {
      const trishulX = layout === "story" ? 540 : width - 120;
      const trishulY = layout === "story" ? 170 : 150;
      return `
        <!-- Divine Golden Trishul Emblem -->
        <g transform="translate(${trishulX}, ${trishulY}) scale(0.7)">
          <path d="M 0 -50 L 0 50" stroke="#FDE047" stroke-width="4" stroke-linecap="round"/>
          <path d="M 0 -50 C 15 -35, 25 -15, 20 5 C 16 18, 0 15, 0 15 C 0 15, -16 18, -20 5 C -25 -15, -15 -35, 0 -50 Z" fill="none" stroke="#FDE047" stroke-width="3"/>
          <circle cx="0" cy="-20" r="10" fill="#DC2626"/>
          <circle cx="0" cy="-20" r="4" fill="#FDE047"/>
        </g>
      `;
    }

    // 3. Vijay Dhanush Bow (Dussehra)
    case "dussehra-golden-bow":
    case "dussehra-vijaya-parv": {
      const bowX = layout === "story" ? width - 120 : width - 130;
      const bowY = layout === "story" ? 220 : 155;
      return `
        <!-- Vijay Dhanush Bow & Arrow -->
        <g transform="translate(${bowX}, ${bowY}) scale(0.85)">
          <path d="M -40 -35 Q 25 0, -40 35" fill="none" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round"/>
          <line x1="-40" y1="-35" x2="-40" y2="35" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="3,2"/>
          <line x1="-48" y1="0" x2="30" y2="0" stroke="#F59E0B" stroke-width="3.5"/>
          <polygon points="30,0 20,-6 20,6" fill="#FDE047"/>
          <circle cx="-10" cy="0" r="5" fill="#EF4444"/>
        </g>
      `;
    }

    // 4. Dhanteras Shubh Kalash
    case "diwali-dhanteras-shubh": {
      const kalashX = layout === "story" ? width - 120 : width - 130;
      const kalashY = layout === "story" ? 220 : 160;
      return `
        <!-- Auspicious Kalash with Gold Coins -->
        <g transform="translate(${kalashX}, ${kalashY}) scale(0.85)">
          <ellipse cx="0" cy="18" rx="22" ry="16" fill="#D97706" stroke="#FDE047" stroke-width="2"/>
          <ellipse cx="0" cy="8" rx="16" ry="6" fill="#F59E0B"/>
          <!-- Spilling Gold Coins -->
          <circle cx="-8" cy="-2" r="6" fill="#FDE047" stroke="#B45309" stroke-width="1"/>
          <circle cx="6" cy="-4" r="7" fill="#FDE047" stroke="#B45309" stroke-width="1"/>
          <circle cx="0" cy="-12" r="7" fill="#FEF08A" stroke="#B45309" stroke-width="1"/>
          <circle cx="-12" cy="8" r="5" fill="#FDE047" stroke="#B45309" stroke-width="0.8"/>
          <circle cx="14" cy="6" r="5" fill="#FDE047" stroke="#B45309" stroke-width="0.8"/>
        </g>
      `;
    }

    // 5. Rangoli Mandala
    case "diwali-rangoli-mandala": {
      const mandalaX = 540;
      const mandalaY = layout === "story" ? 820 : 450;
      return `
        <!-- Central 24K Gold Rangoli Mandala Behind Podium -->
        <g transform="translate(${mandalaX}, ${mandalaY}) scale(1.1)" opacity="0.35">
          <circle cx="0" cy="0" r="140" fill="none" stroke="#FDE047" stroke-width="1.5" stroke-dasharray="4,4"/>
          <circle cx="0" cy="0" r="110" fill="none" stroke="#F59E0B" stroke-width="2"/>
          <circle cx="0" cy="0" r="80" fill="none" stroke="#FDE047" stroke-width="1.5"/>
          ${Array.from({ length: 12 })
            .map(
              (_, i) => `
            <g transform="rotate(${i * 30})">
              <path d="M 0 -110 C -22 -85, -16 -50, 0 -35 C 16 -50, 22 -85, 0 -110 Z" fill="none" stroke="#FDE047" stroke-width="1.5"/>
              <circle cx="0" cy="-90" r="3.5" fill="#FDE047"/>
            </g>
          `
            )
            .join("")}
        </g>
      `;
    }

    // 6. Hanging Akash Kandil (Lantern)
    case "diwali-akash-kandil": {
      const kandilX = width - 110;
      const kandilY = layout === "story" ? 220 : 155;
      return `
        <!-- Hanging Festive Akash Kandil -->
        <g transform="translate(${kandilX}, ${kandilY}) scale(0.85)">
          <line x1="0" y1="-45" x2="0" y2="-20" stroke="#FDE047" stroke-width="2"/>
          <polygon points="0,-20 20,0 0,20 -20,0" fill="#E11D48" stroke="#FDE047" stroke-width="2"/>
          <polygon points="0,-12 12,0 0,12 -12,0" fill="#F59E0B"/>
          <circle cx="0" cy="0" r="5" fill="#FEF08A"/>
          <path d="M -12 20 Q -15 45, -10 70" fill="none" stroke="#F43F5E" stroke-width="2"/>
          <path d="M -4 20 Q -6 50, -2 75" fill="none" stroke="#FBBF24" stroke-width="2"/>
          <path d="M 4 20 Q 6 50, 2 75" fill="none" stroke="#F43F5E" stroke-width="2"/>
          <path d="M 12 20 Q 15 45, 10 70" fill="none" stroke="#FBBF24" stroke-width="2"/>
        </g>
      `;
    }

    // 7. Sparkler Fireworks
    case "diwali-royal-sparklers":
    case "diwali-patakha-celebration": {
      const spX = width - 110;
      const spY = layout === "story" ? 230 : 160;
      return `
        <!-- Radiating Sparkler Burst -->
        <g transform="translate(${spX}, ${spY}) scale(0.9)">
          <line x1="-25" y1="35" x2="0" y2="0" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
          <circle cx="0" cy="0" r="7" fill="#FFFBEB"/>
          ${Array.from({ length: 14 })
            .map(
              (_, i) => `
            <line x1="0" y1="0" x2="${Math.cos((i * Math.PI) / 7) * 32}" y2="${
                Math.sin((i * Math.PI) / 7) * 32
              }" stroke="#FDE047" stroke-width="1.8" stroke-linecap="round"/>
          `
            )
            .join("")}
          <circle cx="20" cy="-18" r="2.5" fill="#FFFFFF"/>
          <circle cx="-18" cy="-15" r="2" fill="#FDE047"/>
          <circle cx="22" cy="12" r="2" fill="#FEF08A"/>
        </g>
      `;
    }

    default:
      return "";
  }
}

/**
 * Main rendering service producing WhatsApp Card (1:1), Instagram Post (1:1), and Instagram Story (9:16)
 * Built to the reference standard: Top royal Indian arch, cascading marigolds, 3D golden stepped pedestal,
 * lit clay diyas with radiant halos, strikethrough MRP, selling price, and horizontal gold ribbon banner.
 */
export async function renderSocialCards(params: CardRenderParams): Promise<RenderedCards> {
  const imgBuffer = params.productImage || params.productImageBuffer;
  if (!imgBuffer) {
    throw new Error("Product image buffer is required for card rendering");
  }

  const rawTitle = params.productTitle || params.title || "Multi-Compartment Premium Bag";
  const titleText = escapeXml(rawTitle.slice(0, 38));
  const storeText = escapeXml(
    params.sellerInfo?.storeName || params.storeName || "Official Brand"
  );

  const templateKey = (params.templateId as TemplateId) || "diwali-sacred-diya";
  const cfg = CARD_TEMPLATES[templateKey] || CARD_TEMPLATES["diwali-sacred-diya"];

  const price = params.price || 999;
  const discountPrice = params.discountPrice || 699;
  const discountPct =
    price && discountPrice && price > discountPrice
      ? Math.round(((price - discountPrice) / price) * 100)
      : 0;

  const currentPriceFormatted = discountPrice
    ? `₹${discountPrice.toLocaleString("en-IN")}`
    : `₹${price.toLocaleString("en-IN")}`;

  const originalPriceFormatted =
    discountPrice && price ? `₹${price.toLocaleString("en-IN")}` : "";

  // =========================================================================
  // 1. WHATSAPP CARD (1080x1080) - REFERENCE MASTER LAYOUT
  // =========================================================================

  // Sizing product cleanly to sit proud on top of the 3D circular golden pedestal
  const waProduct = await sharp(imgBuffer)
    .rotate()
    .resize(520, 420, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const waEmbellishment = getFestivalVectorEmbellishment(templateKey, 1080, 1080, "wa");

  // Background Layer (Gradient, Paisleys, Top Archway, Marigold Garlands, 3D Pedestal)
  const waBgSvg = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Rich Deep Festive Radial Background -->
        <radialGradient id="waStageGrad" cx="50%" cy="46%" r="62%">
          <stop offset="0%" stop-color="${cfg.bgGradEnd}" stop-opacity="1"/>
          <stop offset="60%" stop-color="${cfg.bgGradStart}" stop-opacity="1"/>
          <stop offset="100%" stop-color="#0A0203" stop-opacity="1"/>
        </radialGradient>

        <!-- Center Spotlight Aura Behind Product -->
        <radialGradient id="waSpotlight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FDE047" stop-opacity="0.32"/>
          <stop offset="45%" stop-color="#F59E0B" stop-opacity="0.16"/>
          <stop offset="85%" stop-color="#B45309" stop-opacity="0.04"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>

        <!-- Pedestal Metallic Gradients -->
        <linearGradient id="pedestalBaseRiserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#78350F"/>
          <stop offset="40%" stop-color="#B45309"/>
          <stop offset="100%" stop-color="#451A03"/>
        </linearGradient>

        <linearGradient id="pedestalBaseTopGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#B45309"/>
          <stop offset="30%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#FDE047"/>
          <stop offset="70%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>

        <linearGradient id="pedestalMidRiserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#450A0A"/>
          <stop offset="50%" stop-color="#7F1D1D"/>
          <stop offset="100%" stop-color="#2D0606"/>
        </linearGradient>

        <linearGradient id="pedestalMidTopGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D97706"/>
          <stop offset="35%" stop-color="#FDE047"/>
          <stop offset="50%" stop-color="#FFFBEB"/>
          <stop offset="65%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>

        <linearGradient id="pedestalStageGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#B45309"/>
          <stop offset="25%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#FEF08A"/>
          <stop offset="75%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>

        <!-- Top Arch Gold Gradient -->
        <linearGradient id="archGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="60%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#78350F"/>
        </linearGradient>

        <linearGradient id="archInterior" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#450A0A" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#1A0204" stop-opacity="0.95"/>
        </linearGradient>

        <!-- Flame Radial Halo -->
        <radialGradient id="flameHaloGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFBEB" stop-opacity="0.9"/>
          <stop offset="25%" stop-color="#FDE047" stop-opacity="0.75"/>
          <stop offset="65%" stop-color="#F59E0B" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#EA580C" stop-opacity="0"/>
        </radialGradient>

        <!-- Clay Bowl Gradient -->
        <linearGradient id="diyaClayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#B45309"/>
          <stop offset="60%" stop-color="#92400E"/>
          <stop offset="100%" stop-color="#451A03"/>
        </linearGradient>

        <linearGradient id="diyaFlameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="35%" stop-color="#FDE047"/>
          <stop offset="75%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#DC2626"/>
        </linearGradient>
      </defs>

      <!-- 1. Background Canvas -->
      <rect width="1080" height="1080" fill="url(#waStageGrad)"/>

      <!-- 2. Warm Backdrop Spotlight Glow -->
      <ellipse cx="540" cy="460" rx="360" ry="260" fill="url(#waSpotlight)"/>

      <!-- 3. Symmetrical Traditional Paisley (Kalka) Outline on Left Flank -->
      <g transform="translate(60, 360) scale(0.65)" opacity="0.35">
        <path d="M 0 0 C 40 -80, 120 -60, 100 20 C 80 80, -20 120, -50 70 C -70 40, -40 20, 0 0 Z" fill="none" stroke="#FDE047" stroke-width="2"/>
        <path d="M 20 20 C 40 -30, 80 -20, 70 25 C 60 60, 0 80, -20 50 Z" fill="none" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="3,3"/>
      </g>
      <!-- Symmetrical Traditional Paisley on Right Flank -->
      <g transform="translate(1020, 360) scale(-0.65, 0.65)" opacity="0.35">
        <path d="M 0 0 C 40 -80, 120 -60, 100 20 C 80 80, -20 120, -50 70 C -70 40, -40 20, 0 0 Z" fill="none" stroke="#FDE047" stroke-width="2"/>
        <path d="M 20 20 C 40 -30, 80 -20, 70 25 C 60 60, 0 80, -20 50 Z" fill="none" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="3,3"/>
      </g>

      <!-- 4. Top Royal Indian Palace Jharokha Archway -->
      <g>
        <!-- Outer Gold Arch Rim -->
        <path d="M 30 0 L 30 90 C 30 160, 160 170, 240 200 C 330 235, 430 255, 540 255 C 650 255, 750 235, 840 200 C 920 170, 1050 160, 1050 90 L 1050 0 Z" fill="url(#archInterior)" stroke="url(#archGold)" stroke-width="4"/>
        <!-- Inner Filigree Scallops -->
        <path d="M 50 0 L 50 80 C 50 145, 175 155, 250 185 C 335 218, 430 238, 540 238 C 650 238, 745 218, 830 185 C 905 155, 1030 145, 1030 80 L 1030 0 Z" fill="none" stroke="#FDE047" stroke-width="2" stroke-dasharray="5,4"/>
        
        <!-- Hanging Brass Lamps from Arch (Left) -->
        <g transform="translate(150, 0)">
          <line x1="0" y1="0" x2="0" y2="130" stroke="#FDE047" stroke-width="1.5"/>
          <circle cx="0" cy="130" r="4" fill="#F59E0B"/>
          <ellipse cx="0" cy="140" rx="14" ry="7" fill="#B45309" stroke="#FDE047" stroke-width="1"/>
          <path d="M 0 126 C 4 132, 4 136, 0 138 C -4 136, -4 132, 0 126 Z" fill="#FDE047"/>
        </g>
        <!-- Hanging Brass Lamps from Arch (Right) -->
        <g transform="translate(930, 0)">
          <line x1="0" y1="0" x2="0" y2="130" stroke="#FDE047" stroke-width="1.5"/>
          <circle cx="0" cy="130" r="4" fill="#F59E0B"/>
          <ellipse cx="0" cy="140" rx="14" ry="7" fill="#B45309" stroke="#FDE047" stroke-width="1"/>
          <path d="M 0 126 C 4 132, 4 136, 0 138 C -4 136, -4 132, 0 126 Z" fill="#FDE047"/>
        </g>

        <!-- Top Festival Headline Inside Arch Apex -->
        <text x="540" y="145" font-family="'Playfair Display', Georgia, serif" font-size="52" font-weight="900" fill="#FFFBEB" text-anchor="middle" letter-spacing="0.5">
          ${escapeXml(cfg.headline.split(" ")[0] || "Diwali")}
        </text>
        <text x="540" y="210" font-family="'Playfair Display', Georgia, serif" font-size="56" font-weight="900" fill="#FDE047" text-anchor="middle" letter-spacing="0.5">
          ${escapeXml(cfg.headline.split(" ").slice(1).join(" ") || "Special Offer!")}
        </text>
      </g>

      <!-- 5. Cascading Marigold (Genda Phool) Garlands Down Both Borders -->
      <g>
        <!-- Left Garland -->
        ${Array.from({ length: 9 })
          .map((_, i) => {
            const y = 80 + i * 42;
            const isOrange = i % 2 === 0;
            const color = isOrange ? "#EA580C" : "#FACC15";
            const dark = isOrange ? "#C2410C" : "#CA8A04";
            return `
              <g transform="translate(100, ${y})">
                <circle cx="0" cy="0" r="16" fill="${dark}"/>
                <circle cx="0" cy="0" r="14" fill="${color}"/>
                <circle cx="-4" cy="-4" r="5" fill="#FEF08A" opacity="0.6"/>
                <circle cx="4" cy="4" r="5" fill="${dark}" opacity="0.5"/>
                <circle cx="0" cy="0" r="3" fill="#FFFBEB"/>
              </g>
            `;
          })
          .join("")}
        <!-- Right Garland -->
        ${Array.from({ length: 9 })
          .map((_, i) => {
            const y = 80 + i * 42;
            const isOrange = i % 2 === 0;
            const color = isOrange ? "#EA580C" : "#FACC15";
            const dark = isOrange ? "#C2410C" : "#CA8A04";
            return `
              <g transform="translate(980, ${y})">
                <circle cx="0" cy="0" r="16" fill="${dark}"/>
                <circle cx="0" cy="0" r="14" fill="${color}"/>
                <circle cx="-4" cy="-4" r="5" fill="#FEF08A" opacity="0.6"/>
                <circle cx="4" cy="4" r="5" fill="${dark}" opacity="0.5"/>
                <circle cx="0" cy="0" r="3" fill="#FFFBEB"/>
              </g>
            `;
          })
          .join("")}
      </g>

      <!-- 6. Center 3D Stepped Circular Royal Pedestal (Podium) -->
      <g>
        <!-- Base Tier Platform -->
        <ellipse cx="540" cy="710" rx="310" ry="46" fill="#000000" opacity="0.45"/>
        <path d="M 230 685 C 230 730, 850 730, 850 685 L 850 705 C 850 750, 230 750, 230 705 Z" fill="url(#pedestalBaseRiserGrad)" stroke="#B45309" stroke-width="1.5"/>
        <ellipse cx="540" cy="685" rx="310" ry="42" fill="url(#pedestalBaseTopGrad)" stroke="#FDE047" stroke-width="2"/>

        <!-- Middle Tier with Carved Gold Trim -->
        <path d="M 255 660 C 255 702, 825 702, 825 660 L 825 675 C 825 717, 255 717, 255 675 Z" fill="url(#pedestalMidRiserGrad)" stroke="#78350F" stroke-width="1.5"/>
        <ellipse cx="540" cy="660" rx="285" ry="38" fill="url(#pedestalMidTopGrad)" stroke="#FDE047" stroke-width="2"/>
        <path d="M 280 670 Q 340 688, 400 670 Q 460 688, 520 670 Q 580 688, 640 670 Q 700 688, 760 670 Q 820 688, 880 670" fill="none" stroke="#FDE047" stroke-width="1.5" opacity="0.85"/>

        <!-- Top Platform Surface (Product Stage) -->
        <path d="M 285 632 C 285 670, 795 670, 795 632 L 795 645 C 795 683, 285 683, 285 645 Z" fill="url(#pedestalBaseRiserGrad)" stroke="#B45309" stroke-width="1.5"/>
        <ellipse cx="540" cy="632" rx="255" ry="32" fill="url(#pedestalStageGrad)" stroke="#FFFBEB" stroke-width="2.5"/>
        <ellipse cx="540" cy="632" rx="235" ry="28" fill="none" stroke="#FDE047" stroke-width="1.5" stroke-dasharray="5,4"/>

        <!-- Realistic Soft Product Drop Shadow On Podium -->
        <ellipse cx="540" cy="630" rx="200" ry="18" fill="#000000" opacity="0.5"/>
        <ellipse cx="540" cy="630" rx="140" ry="12" fill="#000000" opacity="0.35"/>
      </g>

      <!-- Optional Template Embellishment -->
      ${waEmbellishment}
    </svg>
  `);

  // Foreground Layer (Lit Clay Diyas, Scattered Petals, Title, Strike Price, Gold Banner, Footer)
  const waFgSvg = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="fgHaloGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFBEB" stop-opacity="0.95"/>
          <stop offset="25%" stop-color="#FDE047" stop-opacity="0.8"/>
          <stop offset="65%" stop-color="#F59E0B" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#EA580C" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="fgClayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#B45309"/>
          <stop offset="60%" stop-color="#92400E"/>
          <stop offset="100%" stop-color="#451A03"/>
        </linearGradient>

        <linearGradient id="fgFlameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="35%" stop-color="#FDE047"/>
          <stop offset="75%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#DC2626"/>
        </linearGradient>

        <!-- Horizontal Gold Ribbon Metallic Gradient -->
        <linearGradient id="goldRibbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D4AF37"/>
          <stop offset="25%" stop-color="#FDE047"/>
          <stop offset="50%" stop-color="#FFFBEB"/>
          <stop offset="75%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#D4AF37"/>
        </linearGradient>
      </defs>

      <!-- 1. Array of Glowing Terracotta Diyas Along Podium Base -->
      <g>
        ${[
          { x: 140, y: 690, s: 0.85 },
          { x: 260, y: 720, s: 1.0 },
          { x: 400, y: 735, s: 0.9 },
          { x: 680, y: 735, s: 0.9 },
          { x: 820, y: 720, s: 1.0 },
          { x: 940, y: 690, s: 0.85 },
        ]
          .map(
            ({ x, y, s }) => `
          <g transform="translate(${x}, ${y}) scale(${s})">
            <!-- Flame Halo -->
            <circle cx="0" cy="-14" r="38" fill="url(#fgHaloGrad)" opacity="0.85"/>
            <circle cx="0" cy="-14" r="22" fill="#FDE047" opacity="0.45"/>
            <!-- Diya Terracotta Bowl -->
            <path d="M -30 6 C -30 20, 30 20, 30 6 C 30 2, -30 2, -30 6 Z" fill="url(#fgClayGrad)" stroke="#78350F" stroke-width="1.5"/>
            <ellipse cx="0" cy="5" rx="28" ry="7" fill="#92400E" stroke="#FDE047" stroke-width="1"/>
            <!-- Glowing Golden Flame -->
            <path d="M 0 -26 C 9 -14, 9 -4, 0 4 C -9 -4, -9 -14, 0 -26 Z" fill="url(#fgFlameGrad)"/>
            <ellipse cx="0" cy="-8" rx="3.5" ry="8" fill="#FFFBEB"/>
          </g>
        `
          )
          .join("")}
      </g>

      <!-- 2. Scattered Marigold Flower Petals on the Floor -->
      <g>
        ${[
          { x: 195, y: 725, r: 15 },
          { x: 340, y: 745, r: -25 },
          { x: 480, y: 748, r: 40 },
          { x: 600, y: 750, r: -10 },
          { x: 740, y: 745, r: 30 },
          { x: 885, y: 725, r: -35 },
        ]
          .map(
            ({ x, y, r }) => `
          <g transform="translate(${x}, ${y}) rotate(${r})">
            <ellipse cx="0" cy="0" rx="8" ry="4" fill="#F59E0B"/>
            <ellipse cx="2" cy="1" rx="6" ry="3" fill="#EA580C"/>
          </g>
        `
          )
          .join("")}
      </g>

      <!-- 3. Product Title -->
      <text x="540" y="750" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="34" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">
        ${titleText}
      </text>

      <!-- 4. Price Row (MRP with authentic Red Strike-Through & Bold Gold Selling Price) -->
      <g>
        ${
          discountPrice && price && price > discountPrice
            ? `
          <text x="540" y="802" text-anchor="middle">
            <tspan font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#E2E8F0">MRP: </tspan>
            <tspan font-family="system-ui, sans-serif" font-size="30" font-weight="700" fill="#CBD5E1">₹${price.toLocaleString("en-IN")}</tspan>
            <tspan font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF">   Selling Price: </tspan>
            <tspan font-family="Georgia, serif" font-size="40" font-weight="900" fill="#FDE047">₹${discountPrice.toLocaleString("en-IN")}</tspan>
          </text>
          <!-- Red Strike Line across MRP -->
          <line x1="315" y1="800" x2="415" y2="788" stroke="#EF4444" stroke-width="3.5" stroke-linecap="round"/>
        `
            : `
          <text x="540" y="802" text-anchor="middle">
            <tspan font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF">Special Price: </tspan>
            <tspan font-family="Georgia, serif" font-size="42" font-weight="900" fill="#FDE047">${currentPriceFormatted}</tspan>
          </text>
        `
        }
      </g>

      <!-- 5. Horizontal Shimmering Metallic Gold Ribbon Banner -->
      <g>
        <rect x="0" y="835" width="1080" height="75" fill="url(#goldRibbonGrad)" stroke="#B45309" stroke-width="1.5"/>
        <rect x="0" y="838" width="1080" height="2" fill="#FFFBEB" opacity="0.6"/>

        <!-- Left & Right Gold Accents -->
        <g transform="translate(60, 872) scale(0.7)">
          <circle cx="0" cy="0" r="16" fill="#B45309"/>
          <ellipse cx="0" cy="2" rx="14" ry="6" fill="#FDE047"/>
          <path d="M 0 -12 C 4 -6, 4 0, 0 4 C -4 0, -4 -6, 0 -12 Z" fill="#DC2626"/>
        </g>
        <g transform="translate(1020, 872) scale(0.7)">
          <circle cx="0" cy="0" r="16" fill="#B45309"/>
          <ellipse cx="0" cy="2" rx="14" ry="6" fill="#FDE047"/>
          <path d="M 0 -12 C 4 -6, 4 0, 0 4 C -4 0, -4 -6, 0 -12 Z" fill="#DC2626"/>
        </g>

        <!-- Festive Tagline -->
        <text x="540" y="865" font-family="Georgia, serif" font-size="22" font-weight="900" fill="#3B1204" text-anchor="middle" letter-spacing="0.3">
          ${escapeXml(cfg.tagline || "Light Up Your Festive Days with This Premium Collection!")}
        </text>

        <!-- Sub-action tags -->
        <text x="430" y="894" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#3B1204" text-anchor="middle">
          🎁 GIFT NOW
        </text>
        <text x="630" y="894" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#3B1204" text-anchor="middle">
          🔗 SHARE WITH FRIENDS
        </text>
      </g>

      <!-- 6. Footer (Whatsapp Shareable Card & Seller Brand Name) -->
      <g>
        <text x="540" y="960" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
          Whatsapp Shareable Card
        </text>
        <text x="540" y="990" font-family="Georgia, serif" font-size="18" font-weight="600" fill="#FDE047" text-anchor="middle">
          [${storeText}]
        </text>
      </g>
    </svg>
  `);

  // Composite WhatsApp Card: Product placed on podium (left: 280, top: 220)
  const whatsappCard = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 18, g: 3, b: 5, alpha: 1 },
    },
  })
    .composite([
      { input: waBgSvg, top: 0, left: 0 },
      { input: waProduct, top: 220, left: 280 },
      { input: waFgSvg, top: 0, left: 0 },
    ])
    .webp({ quality: 92 })
    .toBuffer();

  // =========================================================================
  // 2. INSTAGRAM POST (1080x1080)
  // =========================================================================
  const igProduct = await sharp(imgBuffer)
    .rotate()
    .resize(520, 420, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const igEmbellishment = getFestivalVectorEmbellishment(templateKey, 1080, 1080, "ig");

  const igFgSvg = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Horizontal Gold Ribbon Gradient -->
        <linearGradient id="igGoldRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D4AF37"/>
          <stop offset="25%" stop-color="#FDE047"/>
          <stop offset="50%" stop-color="#FFFBEB"/>
          <stop offset="75%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#D4AF37"/>
        </linearGradient>

        <radialGradient id="igHaloGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFBEB" stop-opacity="0.95"/>
          <stop offset="25%" stop-color="#FDE047" stop-opacity="0.8"/>
          <stop offset="65%" stop-color="#F59E0B" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#EA580C" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="igClayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#B45309"/>
          <stop offset="60%" stop-color="#92400E"/>
          <stop offset="100%" stop-color="#451A03"/>
        </linearGradient>

        <linearGradient id="igFlameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="35%" stop-color="#FDE047"/>
          <stop offset="75%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#DC2626"/>
        </linearGradient>
      </defs>

      <!-- Lit Diyas Along Podium Base -->
      <g>
        ${[
          { x: 140, y: 690, s: 0.85 },
          { x: 260, y: 720, s: 1.0 },
          { x: 400, y: 735, s: 0.9 },
          { x: 680, y: 735, s: 0.9 },
          { x: 820, y: 720, s: 1.0 },
          { x: 940, y: 690, s: 0.85 },
        ]
          .map(
            ({ x, y, s }) => `
          <g transform="translate(${x}, ${y}) scale(${s})">
            <circle cx="0" cy="-14" r="38" fill="url(#igHaloGrad)" opacity="0.85"/>
            <path d="M -30 6 C -30 20, 30 20, 30 6 C 30 2, -30 2, -30 6 Z" fill="url(#igClayGrad)" stroke="#78350F" stroke-width="1.5"/>
            <ellipse cx="0" cy="5" rx="28" ry="7" fill="#92400E" stroke="#FDE047" stroke-width="1"/>
            <path d="M 0 -26 C 9 -14, 9 -4, 0 4 C -9 -4, -9 -14, 0 -26 Z" fill="url(#igFlameGrad)"/>
            <ellipse cx="0" cy="-8" rx="3.5" ry="8" fill="#FFFBEB"/>
          </g>
        `
          )
          .join("")}
      </g>

      <!-- Product Title -->
      <text x="540" y="750" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="34" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">
        ${titleText}
      </text>

      <!-- Price Row -->
      <g>
        ${
          discountPrice && price && price > discountPrice
            ? `
          <text x="540" y="802" text-anchor="middle">
            <tspan font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#E2E8F0">MRP: </tspan>
            <tspan font-family="system-ui, sans-serif" font-size="30" font-weight="700" fill="#CBD5E1">₹${price.toLocaleString("en-IN")}</tspan>
            <tspan font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF">   Selling Price: </tspan>
            <tspan font-family="Georgia, serif" font-size="40" font-weight="900" fill="#FDE047">₹${discountPrice.toLocaleString("en-IN")}</tspan>
          </text>
          <line x1="315" y1="800" x2="415" y2="788" stroke="#EF4444" stroke-width="3.5" stroke-linecap="round"/>
        `
            : `
          <text x="540" y="802" text-anchor="middle">
            <tspan font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF">Special Price: </tspan>
            <tspan font-family="Georgia, serif" font-size="42" font-weight="900" fill="#FDE047">${currentPriceFormatted}</tspan>
          </text>
        `
        }
      </g>

      <!-- Horizontal Metallic Gold Ribbon Banner -->
      <g>
        <rect x="0" y="835" width="1080" height="75" fill="url(#igGoldRibbon)" stroke="#B45309" stroke-width="1.5"/>
        <text x="540" y="865" font-family="Georgia, serif" font-size="22" font-weight="900" fill="#3B1204" text-anchor="middle">
          ${escapeXml(cfg.tagline || "Light Up Your Festive Days with This Premium Collection!")}
        </text>
        <text x="430" y="894" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#3B1204" text-anchor="middle">
          🎁 GIFT NOW
        </text>
        <text x="630" y="894" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#3B1204" text-anchor="middle">
          🔗 SHARE WITH FRIENDS
        </text>
      </g>

      <!-- Instagram Feed Trust Footer -->
      <g>
        <text x="540" y="960" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF" text-anchor="middle">
          ✦ Free All-India Delivery • Cash on Delivery (COD) Available ✦
        </text>
        <text x="540" y="990" font-family="Georgia, serif" font-size="18" font-weight="600" fill="#FDE047" text-anchor="middle">
          DM to Order • [${storeText}]
        </text>
      </g>
    </svg>
  `);

  const instagramPost = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 18, g: 3, b: 5, alpha: 1 },
    },
  })
    .composite([
      { input: waBgSvg, top: 0, left: 0 },
      { input: igProduct, top: 220, left: 280 },
      { input: igFgSvg, top: 0, left: 0 },
    ])
    .webp({ quality: 92 })
    .toBuffer();

  // =========================================================================
  // 3. INSTAGRAM STORY (1080x1920) - 9:16 VERTICAL FESTIVAL SHOWCASE
  // =========================================================================
  const storyProduct = await sharp(imgBuffer)
    .rotate()
    .resize(680, 560, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const storyEmbellishment = getFestivalVectorEmbellishment(templateKey, 1080, 1920, "story");

  const storyBgSvg = Buffer.from(`
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="storyStageGrad" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stop-color="${cfg.bgGradEnd}"/>
          <stop offset="65%" stop-color="${cfg.bgGradStart}"/>
          <stop offset="100%" stop-color="#0A0203"/>
        </radialGradient>

        <radialGradient id="storySpotlight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FDE047" stop-opacity="0.35"/>
          <stop offset="50%" stop-color="#F59E0B" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="storyGoldRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D4AF37"/>
          <stop offset="25%" stop-color="#FDE047"/>
          <stop offset="50%" stop-color="#FFFBEB"/>
          <stop offset="75%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#D4AF37"/>
        </linearGradient>

        <linearGradient id="storyPedBaseTop" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#B45309"/>
          <stop offset="50%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>

        <linearGradient id="storyPedMidTop" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D97706"/>
          <stop offset="50%" stop-color="#FFFBEB"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>

        <linearGradient id="storyPedStage" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#B45309"/>
          <stop offset="50%" stop-color="#FEF08A"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="1080" height="1920" fill="url(#storyStageGrad)"/>

      <!-- Center Spotlight Glow -->
      <ellipse cx="540" cy="740" rx="420" ry="320" fill="url(#storySpotlight)"/>

      <!-- Top Royal Indian Palace Gateway Arch -->
      <g>
        <path d="M 40 0 L 40 180 C 40 280, 200 300, 320 340 C 420 375, 480 395, 540 395 C 600 395, 660 375, 760 340 C 880 300, 1040 280, 1040 180 L 1040 0 Z" fill="#2B0505" stroke="#FDE047" stroke-width="4"/>
        <path d="M 60 0 L 60 170 C 60 260, 210 280, 330 320 C 425 355, 480 375, 540 375 C 600 375, 655 355, 750 320 C 870 280, 1020 260, 1020 170 L 1020 0 Z" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="6,4"/>

        <!-- Top Brand Tag Pill -->
        <rect x="360" y="80" width="360" height="48" rx="24" fill="#0A0203" stroke="#FDE047" stroke-width="1.5" opacity="0.9"/>
        <text x="540" y="112" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" font-weight="800" fill="#FDE047" text-anchor="middle" letter-spacing="1">
          ✦ ${storeText} ✦
        </text>

        <!-- Story Headline Inside Arch -->
        <text x="540" y="240" font-family="'Playfair Display', Georgia, serif" font-size="64" font-weight="900" fill="#FFFBEB" text-anchor="middle">
          ${escapeXml(cfg.headline.split(" ")[0] || "Diwali")}
        </text>
        <text x="540" y="320" font-family="'Playfair Display', Georgia, serif" font-size="70" font-weight="900" fill="#FDE047" text-anchor="middle">
          ${escapeXml(cfg.headline.split(" ").slice(1).join(" ") || "Special Offer!")}
        </text>
      </g>

      <!-- Cascading Vertical Marigolds Along Story Edges -->
      <g>
        ${Array.from({ length: 16 })
          .map((_, i) => {
            const y = 200 + i * 48;
            const isOrange = i % 2 === 0;
            const color = isOrange ? "#EA580C" : "#FACC15";
            return `
              <g transform="translate(90, ${y})">
                <circle cx="0" cy="0" r="17" fill="${isOrange ? "#C2410C" : "#CA8A04"}"/>
                <circle cx="0" cy="0" r="14" fill="${color}"/>
                <circle cx="-4" cy="-4" r="5" fill="#FEF08A" opacity="0.6"/>
              </g>
              <g transform="translate(990, ${y})">
                <circle cx="0" cy="0" r="17" fill="${isOrange ? "#C2410C" : "#CA8A04"}"/>
                <circle cx="0" cy="0" r="14" fill="${color}"/>
                <circle cx="-4" cy="-4" r="5" fill="#FEF08A" opacity="0.6"/>
              </g>
            `;
          })
          .join("")}
      </g>

      <!-- 3D Circular Pedestal in Story Center (Stage at y = 1000) -->
      <g>
        <ellipse cx="540" cy="1080" rx="350" ry="52" fill="#000000" opacity="0.5"/>
        <path d="M 190 1050 C 190 1105, 890 1105, 890 1050 L 890 1075 C 890 1130, 190 1130, 190 1075 Z" fill="#451A03" stroke="#B45309" stroke-width="2"/>
        <ellipse cx="540" cy="1050" rx="350" ry="48" fill="url(#storyPedBaseTop)" stroke="#FDE047" stroke-width="2.5"/>

        <path d="M 220 1020 C 220 1070, 860 1070, 860 1020 L 860 1040 C 860 1090, 220 1090, 220 1040 Z" fill="#2D0606" stroke="#78350F" stroke-width="2"/>
        <ellipse cx="540" cy="1020" rx="320" ry="42" fill="url(#storyPedMidTop)" stroke="#FDE047" stroke-width="2"/>

        <path d="M 250 990 C 250 1035, 830 1035, 830 990 L 830 1005 C 830 1050, 250 1050, 250 1005 Z" fill="#451A03" stroke="#B45309" stroke-width="2"/>
        <ellipse cx="540" cy="990" rx="290" ry="36" fill="url(#storyPedStage)" stroke="#FFFBEB" stroke-width="3"/>

        <!-- Product Contact Shadow on Podium Surface -->
        <ellipse cx="540" cy="988" rx="230" ry="20" fill="#000000" opacity="0.55"/>
      </g>

      ${storyEmbellishment}
    </svg>
  `);

  const storyFgSvg = Buffer.from(`
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="storyHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFBEB" stop-opacity="0.95"/>
          <stop offset="25%" stop-color="#FDE047" stop-opacity="0.8"/>
          <stop offset="65%" stop-color="#F59E0B" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#EA580C" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="storyBtnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>

        <linearGradient id="storyGoldRibbonFg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D4AF37"/>
          <stop offset="25%" stop-color="#FDE047"/>
          <stop offset="50%" stop-color="#FFFBEB"/>
          <stop offset="75%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#D4AF37"/>
        </linearGradient>
      </defs>

      <!-- Lit Diyas Along Story Podium Base -->
      <g>
        ${[
          { x: 160, y: 1060, s: 0.95 },
          { x: 300, y: 1100, s: 1.1 },
          { x: 440, y: 1120, s: 1.0 },
          { x: 640, y: 1120, s: 1.0 },
          { x: 780, y: 1100, s: 1.1 },
          { x: 920, y: 1060, s: 0.95 },
        ]
          .map(
            ({ x, y, s }) => `
          <g transform="translate(${x}, ${y}) scale(${s})">
            <circle cx="0" cy="-16" r="42" fill="url(#storyHalo)" opacity="0.85"/>
            <path d="M -30 6 C -30 20, 30 20, 30 6 C 30 2, -30 2, -30 6 Z" fill="#92400E" stroke="#78350F" stroke-width="1.5"/>
            <ellipse cx="0" cy="5" rx="28" ry="7" fill="#B45309" stroke="#FDE047" stroke-width="1"/>
            <path d="M 0 -28 C 9 -16, 9 -4, 0 4 C -9 -4, -9 -16, 0 -28 Z" fill="#FDE047"/>
            <ellipse cx="0" cy="-10" rx="3.5" ry="9" fill="#FFFBEB"/>
          </g>
        `
          )
          .join("")}
      </g>

      <!-- Product Title -->
      <text x="540" y="1220" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF" text-anchor="middle">
        ${titleText}
      </text>

      <!-- Price Row -->
      <g>
        ${
          discountPrice && price && price > discountPrice
            ? `
          <text x="540" y="1295" text-anchor="middle">
            <tspan font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="#E2E8F0">MRP: </tspan>
            <tspan font-family="system-ui, sans-serif" font-size="38" font-weight="700" fill="#CBD5E1">₹${price.toLocaleString("en-IN")}</tspan>
            <tspan font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">   Selling Price: </tspan>
            <tspan font-family="Georgia, serif" font-size="52" font-weight="900" fill="#FDE047">₹${discountPrice.toLocaleString("en-IN")}</tspan>
          </text>
          <line x1="285" y1="1292" x2="415" y2="1278" stroke="#EF4444" stroke-width="4.5" stroke-linecap="round"/>
        `
            : `
          <text x="540" y="1295" text-anchor="middle">
            <tspan font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="#FFFFFF">Special Price: </tspan>
            <tspan font-family="Georgia, serif" font-size="54" font-weight="900" fill="#FDE047">${currentPriceFormatted}</tspan>
          </text>
        `
        }
      </g>

      <!-- Metallic Gold Ribbon Banner -->
      <g>
        <rect x="60" y="1350" width="960" height="90" rx="16" fill="url(#storyGoldRibbonFg)" stroke="#B45309" stroke-width="2"/>
        <text x="540" y="1388" font-family="Georgia, serif" font-size="26" font-weight="900" fill="#3B1204" text-anchor="middle">
          ${escapeXml(cfg.tagline || "Light Up Your Festive Days with This Premium Collection!")}
        </text>
        <text x="430" y="1424" font-family="system-ui, sans-serif" font-size="16" font-weight="800" fill="#3B1204" text-anchor="middle">
          🎁 GIFT NOW
        </text>
        <text x="650" y="1424" font-family="system-ui, sans-serif" font-size="16" font-weight="800" fill="#3B1204" text-anchor="middle">
          🔗 SHARE WITH FRIENDS
        </text>
      </g>

      <!-- Trust Badges -->
      <text x="540" y="1500" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#E2E8F0" text-anchor="middle">
        ✓ Free All-India Delivery   •   ✓ Cash on Delivery (COD) Available
      </text>

      <!-- Tap to Order / DM Now Interactive CTA -->
      <g>
        <rect x="120" y="1560" width="840" height="110" rx="55" fill="url(#storyBtnGrad)" stroke="#FFFBEB" stroke-width="2.5" filter="drop-shadow(0 15px 25px rgba(245,158,11,0.4))"/>
        <text x="540" y="1628" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="32" font-weight="900" fill="#1C0D02" text-anchor="middle" letter-spacing="0.5">
          👆 Tap or DM to Order on WhatsApp
        </text>
      </g>

      <!-- Story Footer -->
      <text x="540" y="1760" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
        Whatsapp Shareable Story
      </text>
      <text x="540" y="1800" font-family="Georgia, serif" font-size="20" font-weight="600" fill="#FDE047" text-anchor="middle">
        [${storeText}]
      </text>
    </svg>
  `);

  // Composite Story: Product placed on podium (left: 200, top: 430)
  const instagramStory = await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 18, g: 3, b: 5, alpha: 1 },
    },
  })
    .composite([
      { input: storyBgSvg, top: 0, left: 0 },
      { input: storyProduct, top: 430, left: 200 },
      { input: storyFgSvg, top: 0, left: 0 },
    ])
    .webp({ quality: 92 })
    .toBuffer();

  return {
    whatsappCard,
    whatsapp: whatsappCard,
    instagramPost,
    instagramStory,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
