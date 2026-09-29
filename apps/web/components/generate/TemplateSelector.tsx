"use client";

import React, { useState } from "react";
import { Check, Sparkles, Palette } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { CARD_TEMPLATES_INFO, CardTemplateInfo, TemplateId } from "~/lib/card-templates";

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
  const [filter, setFilter] = useState<string>("all");

  const categories = [
    { id: "all", label: "All 10 Styles" },
    { id: "luxury", label: "Luxury & Prestige" },
    { id: "modern", label: "Modern & Tech" },
    { id: "ethnic", label: "Ethnic & Festive" },
    { id: "sale", label: "Deals & Trending" },
  ];

  const filteredTemplates = CARD_TEMPLATES_INFO.filter((tpl) => {
    if (filter === "all") return true;
    if (filter === "luxury") return tpl.id === "minimal-luxury" || tpl.id === "midnight-gold" || tpl.id === "editorial-vogue";
    if (filter === "modern") return tpl.id === "clean-modern" || tpl.id === "nordic-slate";
    if (filter === "ethnic") return tpl.id === "royal-emerald" || tpl.id === "festive-crimson";
    if (filter === "sale") return tpl.id === "neon-cyber" || tpl.id === "pastel-bloom" || tpl.id === "sunset-glow";
    return true;
  });

  const displayTitle = previewTitle.trim() || "Exclusive Product";
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
          <Palette className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Card & Story Design Theme (Choose 1 of 10)
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] w-fit border-indigo-500/30 text-indigo-400 font-medium">
          Auto-Applies to WhatsApp, IG Posts & Stories
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
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
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
                  ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/5 shadow-md shadow-indigo-500/10 scale-[1.02]"
                  : "border-border/60 hover:border-border hover:bg-muted/20"
              }`}
            >
              {/* Active Checkmark Pill */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md animate-scale-in">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              )}

              {/* Visual Card Miniature */}
              <div
                className={`w-full aspect-[4/3] rounded-lg bg-gradient-to-b ${tpl.cardGradClass} border ${tpl.borderClass} p-2 relative overflow-hidden flex flex-col justify-between shadow-inner`}
              >
                {/* Mini Top Row: Badge & Store */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider ${tpl.tagBadgeClass}`}
                  >
                    {tpl.tag}
                  </span>
                  <span className={`text-[8px] font-bold opacity-75 truncate max-w-[60px] ${tpl.isDark ? "text-slate-300" : "text-slate-600"}`}>
                    ✦ STORE
                  </span>
                </div>

                {/* Mini Product Simulation Box */}
                <div className="my-auto flex items-center justify-center">
                  <div className="h-7 w-12 rounded bg-black/10 dark:bg-white/10 flex items-center justify-center border border-black/5 dark:border-white/5">
                    <Sparkles className={`h-3 w-3 opacity-60 ${tpl.isDark ? "text-amber-300" : "text-indigo-600"}`} />
                  </div>
                </div>

                {/* Mini Bottom Row: Title, Price & Button */}
                <div className="space-y-0.5">
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
