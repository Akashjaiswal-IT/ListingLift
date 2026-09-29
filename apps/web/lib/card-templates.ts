export type TemplateId =
  | "minimal-luxury"
  | "midnight-gold"
  | "clean-modern"
  | "neon-cyber"
  | "royal-emerald"
  | "pastel-bloom"
  | "sunset-glow"
  | "nordic-slate"
  | "festive-crimson"
  | "editorial-vogue";

export interface CardTemplateInfo {
  id: TemplateId;
  name: string;
  category: string;
  description: string;
  tag: string;
  isDark: boolean;
  accentHex: string;
  accentBgClass: string;
  containerBg: string;
  cardGradClass: string;
  borderClass: string;
  titleColorClass: string;
  priceColorClass: string;
  ctaClass: string;
  tagBadgeClass: string;
}

export const CARD_TEMPLATES_INFO: CardTemplateInfo[] = [
  {
    id: "minimal-luxury",
    name: "Luxury Minimalist",
    category: "High-End & Designer",
    description: "Ivory tones, obsidian serif styling, and champagne gold accents",
    tag: "LUXE",
    isDark: false,
    accentHex: "#D4AF37",
    accentBgClass: "bg-amber-500",
    containerBg: "bg-white",
    cardGradClass: "from-stone-50 via-amber-50/30 to-stone-100",
    borderClass: "border-stone-300 dark:border-stone-700",
    titleColorClass: "text-stone-900 font-serif",
    priceColorClass: "text-amber-700",
    ctaClass: "bg-stone-900 text-stone-50",
    tagBadgeClass: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    id: "midnight-gold",
    name: "Midnight Prestige",
    category: "Prestige & Premium",
    description: "Deep obsidian gradient with metallic 24K gold foil badges",
    tag: "PRESTIGE",
    isDark: true,
    accentHex: "#F59E0B",
    accentBgClass: "bg-amber-400",
    containerBg: "bg-slate-900",
    cardGradClass: "from-slate-950 via-indigo-950/80 to-slate-900",
    borderClass: "border-amber-500/40",
    titleColorClass: "text-white font-sans",
    priceColorClass: "text-amber-400",
    ctaClass: "bg-amber-500 text-slate-950 font-bold",
    tagBadgeClass: "bg-indigo-950/90 text-amber-300 border-amber-500/50",
  },
  {
    id: "clean-modern",
    name: "Studio Clean White",
    category: "Tech & Lifestyle",
    description: "Crisp white studio layout with electric indigo focus",
    tag: "MODERN",
    isDark: false,
    accentHex: "#4F46E5",
    accentBgClass: "bg-indigo-600",
    containerBg: "bg-white",
    cardGradClass: "from-slate-50 via-indigo-50/40 to-slate-100",
    borderClass: "border-slate-300 dark:border-slate-700",
    titleColorClass: "text-slate-900 font-sans",
    priceColorClass: "text-indigo-600",
    ctaClass: "bg-indigo-600 text-white",
    tagBadgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  {
    id: "neon-cyber",
    name: "Neon Cyber Sale",
    category: "Streetwear & Flash Deals",
    description: "Electric cyan and hot magenta cyber aesthetic for high-impact drops",
    tag: "FLASH SALE",
    isDark: true,
    accentHex: "#06B6D4",
    accentBgClass: "bg-cyan-400",
    containerBg: "bg-zinc-950",
    cardGradClass: "from-black via-zinc-950 to-cyan-950/50",
    borderClass: "border-cyan-500/60 shadow-cyan-500/10",
    titleColorClass: "text-cyan-300 font-mono tracking-tight",
    priceColorClass: "text-rose-400",
    ctaClass: "bg-cyan-400 text-black font-bold",
    tagBadgeClass: "bg-rose-950/80 text-rose-300 border-rose-500/50",
  },
  {
    id: "royal-emerald",
    name: "Royal Emerald",
    category: "Heritage & Traditional",
    description: "Deep forest emerald backdrop with opulent brass gold trim",
    tag: "HERITAGE",
    isDark: true,
    accentHex: "#10B981",
    accentBgClass: "bg-emerald-500",
    containerBg: "bg-emerald-950",
    cardGradClass: "from-emerald-950 via-teal-950 to-emerald-900",
    borderClass: "border-emerald-500/50",
    titleColorClass: "text-emerald-100 font-serif",
    priceColorClass: "text-amber-300",
    ctaClass: "bg-amber-500 text-emerald-950 font-bold",
    tagBadgeClass: "bg-emerald-900 text-amber-300 border-amber-500/40",
  },
  {
    id: "pastel-bloom",
    name: "Soft Pastel Chic",
    category: "Beauty & Fashion",
    description: "Delicate blush and rose gold tones with soft organic curves",
    tag: "TRENDING",
    isDark: false,
    accentHex: "#E11D48",
    accentBgClass: "bg-rose-500",
    containerBg: "bg-white",
    cardGradClass: "from-rose-50 via-pink-50 to-rose-100/60",
    borderClass: "border-rose-200 dark:border-rose-900",
    titleColorClass: "text-rose-950 font-sans",
    priceColorClass: "text-rose-600",
    ctaClass: "bg-rose-500 text-white",
    tagBadgeClass: "bg-rose-100 text-rose-700 border-rose-300",
  },
  {
    id: "sunset-glow",
    name: "Sunset Radiance",
    category: "Summer & Activewear",
    description: "Blazing amber to magenta sunset energy with high-contrast text",
    tag: "HOT DEAL",
    isDark: true,
    accentHex: "#EA580C",
    accentBgClass: "bg-orange-500",
    containerBg: "bg-stone-900",
    cardGradClass: "from-stone-950 via-purple-950/70 to-orange-950/80",
    borderClass: "border-orange-500/50",
    titleColorClass: "text-white font-sans",
    priceColorClass: "text-orange-400",
    ctaClass: "bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold",
    tagBadgeClass: "bg-orange-950 text-orange-300 border-orange-500/50",
  },
  {
    id: "nordic-slate",
    name: "Nordic Minimalist",
    category: "Industrial & Minimal",
    description: "Muted charcoal and brushed steel with Swiss typographic precision",
    tag: "STUDIO",
    isDark: true,
    accentHex: "#38BDF8",
    accentBgClass: "bg-sky-400",
    containerBg: "bg-slate-900",
    cardGradClass: "from-slate-950 via-zinc-900 to-slate-900",
    borderClass: "border-slate-700",
    titleColorClass: "text-slate-100 font-sans",
    priceColorClass: "text-sky-400",
    ctaClass: "bg-sky-400 text-slate-950 font-bold",
    tagBadgeClass: "bg-slate-800 text-slate-300 border-slate-700",
  },
  {
    id: "festive-crimson",
    name: "Festive Crimson",
    category: "Festive & Wedding",
    description: "Regal ruby crimson with celebratory marigold yellow flourishes",
    tag: "CELEBRATION",
    isDark: true,
    accentHex: "#DC2626",
    accentBgClass: "bg-red-600",
    containerBg: "bg-red-950",
    cardGradClass: "from-red-950 via-rose-950 to-red-900",
    borderClass: "border-amber-500/50",
    titleColorClass: "text-rose-100 font-serif",
    priceColorClass: "text-yellow-300",
    ctaClass: "bg-yellow-400 text-red-950 font-bold",
    tagBadgeClass: "bg-red-900 text-yellow-300 border-yellow-500/40",
  },
  {
    id: "editorial-vogue",
    name: "Editorial Vogue",
    category: "Couture & Editorial",
    description: "High-contrast monochrome couture layout with vivid scarlet accents",
    tag: "LIMITED EDIT",
    isDark: false,
    accentHex: "#EF4444",
    accentBgClass: "bg-red-500",
    containerBg: "bg-zinc-950",
    cardGradClass: "from-zinc-100 via-neutral-100 to-zinc-200",
    borderClass: "border-zinc-400 dark:border-zinc-800",
    titleColorClass: "text-zinc-950 font-serif font-black",
    priceColorClass: "text-red-600",
    ctaClass: "bg-zinc-950 text-white font-bold",
    tagBadgeClass: "bg-red-600 text-white border-red-700",
  },
];

export const CARD_TEMPLATES_MAP: Record<TemplateId, CardTemplateInfo> = Object.fromEntries(
  CARD_TEMPLATES_INFO.map((t) => [t.id, t])
) as Record<TemplateId, CardTemplateInfo>;

