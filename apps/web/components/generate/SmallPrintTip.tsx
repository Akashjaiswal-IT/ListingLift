"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useLanguage } from "~/providers/LanguageContext";

const STORAGE_KEY = "peshkar_small_print_tip_seen";

/**
 * One-time heads-up that image models can't copy dense tiny print faithfully.
 * Hidden until mounted so server and client render the same markup.
 */
export function SmallPrintTip() {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage blocked (private mode): skip the tip rather than show it every time.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Nothing to persist; it stays hidden for this visit.
    }
  };

  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 sm:flex-row sm:items-start"
    >
      <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {isHi ? "छोटे छपे टेक्स्ट वाले उत्पादों के लिए सुझाव" : "Tip for products with small printed text"}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isHi
            ? "कैलकुलेटर, लेबल या पैकेजिंग जैसे उत्पादों पर छोटा छपा टेक्स्ट दोबारा बन सकता है। बड़े ब्रांड नाम और मॉडल नंबर सही रहते हैं। ऐसी फ़ोटो पर \"विवरण जांचें\" दिखेगा — अपलोड करने से पहले जांच लें।"
            : "On products like calculators, labels or packaging, small printed text may be redrawn. Large brand names and model numbers stay exact. Those images will show \"Check details\" so you can review them before uploading."}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={dismiss} className="shrink-0 self-end sm:self-start">
        {isHi ? "समझ गया" : "Got it"}
      </Button>
    </div>
  );
}
