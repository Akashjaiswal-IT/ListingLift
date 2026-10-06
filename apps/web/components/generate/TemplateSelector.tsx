"use client";

import React, { useState } from "react";
import { Check, Sparkles, Palette } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { CARD_TEMPLATES_INFO, CardTemplateInfo, TemplateId } from "~/lib/card-templates";
import { useLanguage } from "~/providers/LanguageContext";

interface TemplateSelectorProps {
  selectedTemplateId: TemplateId;
  onSelectTemplate: (id: TemplateId) => void;
  previewTitle?: string;
  previewPrice?: string;
  previewDiscountPrice?: string;
  previewCta?: string;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  previewTitle = "Product Title",
  previewPrice = "999",
  previewDiscountPrice = "499",
  previewCta = "Order Now",
}: TemplateSelectorProps) {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const [filter, setFilter] = useState<string>("all");

  const categories = [
    { id: "all", label: isHi ? "सभी 35 थीम्स" : "All 35 Themes" },
    { id: "diwali", label: isHi ? "🪔 शुभ दिवाली (9)" : "🪔 Shubh Diwali (9)" },
    { id: "navratri", label: isHi ? "🌟 नवरात्रि उत्सव (8)" : "🌟 Navratri Utsav (8)" },
    { id: "dussehra", label: isHi ? "🏹 दशहरा विजय (8)" : "🏹 Dussehra Vijay (8)" },
    { id: "classic", label: isHi ? "👑 लग्जरी स्टूडियो (10)" : "👑 Studio Luxe (10)" },
  ];

  const filteredTemplates = CARD_TEMPLATES_INFO.filter((tpl) => {
    if (filter === "all") return true;
    if (filter === "diwali") return tpl.festivalSection === "diwali";
    if (filter === "navratri") return tpl.festivalSection === "navratri";
    if (filter === "dussehra") return tpl.festivalSection === "dussehra";
    if (filter === "classic") return tpl.festivalSection === "luxury" || !tpl.festivalSection;
    return true;
  });

  const displayTitle = previewTitle.trim() || (isHi ? "प्रीमियम उत्पाद" : "Exclusive Product");
  const displayPrice = previewDiscountPrice
    ? `₹${previewDiscountPrice}`
    : previewPrice
    ? `₹${previewPrice}`
    : "₹499";
  const displayMrp = previewDiscountPrice && previewPrice ? `₹${previewPrice}` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isHi ? "कार्ड और स्टोरी डिज़ाइन थीम (35 में से चुनें)" : "Card & Story Design Theme (Choose 1 of 35)"}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] w-fit border-primary/30 text-primary font-medium">
          {isHi ? "व्हाट्सएप, IG पोस्ट और स्टोरीज़ पर स्वतः लागू" : "Auto-Applies to WhatsApp, IG Posts & Stories"}
        </Badge>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilter(cat.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === cat.id
                ? "bg-primary text-white shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Visual Template Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 pt-1">
        {filteredTemplates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;

          return (
            <div
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl.id)}
              className={`group relative cursor-pointer rounded-xl border p-2.5 transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md scale-[1.02]"
                  : "border-border/60 hover:border-border hover:bg-muted/20"
              }`}
            >
              {/* Active Checkmark Pill */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-md animate-scale-in">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              )}

              {/* Visual Card Miniature */}
              <div
                className={`w-full aspect-[4/3] rounded-lg bg-gradient-to-b ${tpl.cardGradClass} border ${tpl.borderClass} p-2 relative overflow-hidden flex flex-col justify-between shadow-inner`}
              >
                {/* Top Subtle Royal Arch Contour */}
                <div className="absolute top-0 inset-x-0 h-4 border-b border-amber-400/30 bg-black/15 rounded-b-xl pointer-events-none" />

                {/* Mini Top Row: Badge & Store */}
                <div className="relative z-10 flex items-center justify-between">
                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider ${tpl.tagBadgeClass}`}
                  >
                    {tpl.tag}
                  </span>
                  <span className={`text-[8px] font-bold opacity-75 truncate max-w-[60px] ${tpl.isDark ? "text-slate-300" : "text-slate-600"}`}>
                    ✦ STORE
                  </span>
                </div>

                {/* Mini 3D Stepped Pedestal Simulation */}
                <div className="relative z-10 my-auto flex flex-col items-center justify-center space-y-1">
                  <span className={`text-[8px] font-serif font-black ${tpl.titleColorClass} line-clamp-1 text-center`}>
                    {tpl.headline || tpl.name}
                  </span>
                  <div className="w-16 h-3 rounded-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 border border-amber-300/80 shadow-xs flex items-center justify-center">
                    <Sparkles className="h-2 w-2 text-stone-900" />
                  </div>
                </div>

                {/* Mini Bottom Row: Title, Price & Button */}
                <div className="relative z-10 space-y-0.5">
                  <p className={`text-[9px] font-bold line-clamp-1 leading-tight ${tpl.titleColorClass}`}>
                    {displayTitle}
                  </p>
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[10px] font-black leading-none ${tpl.priceColorClass}`}>
                        {displayPrice}
                      </span>
                      {displayMrp && (
                        <span className="text-[7px] text-muted-foreground line-through opacity-70">
                          {displayMrp}
                        </span>
                      )}
                    </div>
                    <div className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold ${tpl.ctaClass}`}>
                      {previewCta.slice(0, 9)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Labels */}
              <div className="mt-2 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold tracking-tight text-foreground truncate">
                    {tpl.name}
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {tpl.category}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
