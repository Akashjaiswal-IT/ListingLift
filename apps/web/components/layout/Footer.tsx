"use client";

import Link from "next/link";
import { useLanguage } from "~/providers/LanguageContext";

export function Footer() {
  const { language, t } = useLanguage();

  return (
    <footer className="border-t border-border/60 bg-[#161311] text-[#FAF7F2] py-14">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-3">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary text-white font-black text-lg flex items-center justify-center">
                P
              </div>
              <span className="text-2xl font-black font-serif tracking-tight text-white">
                Peshkar AI
              </span>
            </Link>
            <p className="text-xs text-stone-400 max-w-sm leading-relaxed">
              {t.footer.mission}
            </p>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300">
              {t.footer.colProduct}
            </h4>
            <ul className="space-y-2 text-xs text-stone-400">
              <li>
                <Link href="/app/generate" className="hover:text-white transition-colors">
                  {language === "hi" ? "AI स्टूडियो रीवैम्प" : "AI Studio Revamp"}
                </Link>
              </li>
              <li>
                <Link href="/app/generate" className="hover:text-white transition-colors">
                  {language === "hi" ? "मल्टी-फ़ोटो लिस्टिंग किट्स" : "Multi-Photo Listing Kits"}
                </Link>
              </li>
              <li>
                <Link href="/app/dashboard" className="hover:text-white transition-colors">
                  {language === "hi" ? "मीशो और अमेज़ॅन ऑप्टिमाइज़ेशन" : "Meesho & Amazon Optimization"}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  {language === "hi" ? "क्रेडिट पैक्स व प्राइसिंग" : "Credit Packs & Pricing"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Help */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300">
              {t.footer.colHelp}
            </h4>
            <ul className="space-y-2 text-xs text-stone-400">
              <li>
                <a
                  href="https://api.whatsapp.com/send?text=Hello%20Peshkar%20AI%20Support"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  {language === "hi" ? "व्हाट्सएप सपोर्ट" : "WhatsApp Support"}
                </a>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-white transition-colors">
                  {language === "hi" ? "रिफंड व क्रेडिट पॉलिसी" : "Refund & Credit Policy"}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  {language === "hi" ? "सेवा की शर्तें (Terms)" : "Terms of Service"}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  {language === "hi" ? "गोपनीयता नीति (Privacy)" : "Privacy Policy"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Account */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300">
              {t.footer.colAccount}
            </h4>
            <ul className="space-y-2 text-xs text-stone-400">
              <li>
                <Link href="/app/profile" className="hover:text-white transition-colors">
                  {language === "hi" ? "सेलर स्टोर प्रोफ़ाइल" : "Seller Store Profile"}
                </Link>
              </li>
              <li>
                <Link href="/app/credits" className="hover:text-white transition-colors">
                  {language === "hi" ? "क्रेडिट लेजर और बैलेंस" : "Credit Ledger & Balance"}
                </Link>
              </li>
              <li>
                <Link href="/app/history" className="hover:text-white transition-colors">
                  {language === "hi" ? "कैटलॉग इतिहास" : "Catalog History"}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-stone-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500">
          <p>{t.footer.rights}</p>
          <p className="mt-2 sm:mt-0 font-medium text-stone-400">
            {t.footer.madeWith}
          </p>
        </div>
      </div>
    </footer>
  );
}
