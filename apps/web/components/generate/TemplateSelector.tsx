"use client";

import React, { useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  CARD_TEMPLATES_INFO,
  CARD_TEMPLATES_MAP,
  CARD_TEMPLATE_GROUPS,
  CardTemplateGroup,
  TemplateId,
  resolveTemplateId,
} from "~/lib/card-templates";
import { useLanguage } from "~/providers/LanguageContext";

interface TemplateSelectorProps {
  selectedTemplateId: TemplateId;
  onSelectTemplate: (id: TemplateId) => void;
  // Previews are pre-rendered images now; these are accepted so existing callers keep compiling.
  previewTitle?: string;
  previewPrice?: string;
  previewDiscountPrice?: string;
  previewCta?: string;
}

export function TemplateSelector({ selectedTemplateId, onSelectTemplate }: TemplateSelectorProps) {
  const { language } = useLanguage();
  const isHi = language === "hi";

  // Old listings may carry a retired ID; highlight the template it now renders as.
  const activeId = resolveTemplateId(selectedTemplateId);
  const activeTemplate = CARD_TEMPLATES_MAP[activeId];
  const [group, setGroup] = useState<CardTemplateGroup>(activeTemplate?.group ?? "everyday");
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const templates = CARD_TEMPLATES_INFO.filter((t) => t.group === group);
  const selectedIndex = templates.findIndex((t) => t.id === activeId);
  // Roving tabindex: Tab lands on the selected option (or the first one), arrows move within the group.
  const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + templates.length) % templates.length;
    const target = templates[next];
    if (!target) return;
    onSelectTemplate(target.id);
    optionRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Palette className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isHi ? "कार्ड डिज़ाइन" : "Card design"}
          </span>
          {activeTemplate && (
            <span className="text-xs font-semibold text-foreground truncate">
              · {isHi ? activeTemplate.name.hi : activeTemplate.name.en}
            </span>
          )}
        </div>
        <Badge variant="outline" className="text-xs w-fit border-primary/30 text-primary font-medium">
          {isHi ? "व्हाट्सएप, IG पोस्ट और स्टोरी पर लागू" : "Applies to WhatsApp, IG post & story"}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CARD_TEMPLATE_GROUPS.map((g) => {
          const isActive = group === g.id;
          const hasSelection = activeTemplate?.group === g.id;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setGroup(g.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {isHi ? g.label.hi : g.label.en}
              {hasSelection && !isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={isHi ? "कार्ड डिज़ाइन चुनें" : "Choose a card design"}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
      >
        {templates.map((tpl, index) => {
          const isSelected = tpl.id === activeId;
          const name = isHi ? tpl.name.hi : tpl.name.en;
          return (
            <button
              key={tpl.id}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => onSelectTemplate(tpl.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`group relative rounded-xl border p-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                  : "border-border/60 hover:border-border hover:bg-muted/20"
              }`}
            >
              {isSelected && (
                <span className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </span>
              )}
              <img
                src={tpl.previewSrc}
                alt=""
                width={480}
                height={480}
                loading="lazy"
                className="w-full aspect-square rounded-lg bg-muted object-cover"
              />
              <span
                className={`mt-1.5 block px-0.5 text-xs leading-snug line-clamp-2 ${
                  isSelected ? "font-bold text-foreground" : "font-medium text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
