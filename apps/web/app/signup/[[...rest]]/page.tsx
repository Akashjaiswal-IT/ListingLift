"use client";

import { SignUp } from "@clerk/nextjs";
import { Sparkles, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { useLanguage } from "~/providers/LanguageContext";

export default function SignUpPage() {
  const { language, t } = useLanguage();
  const isHi = language === "hi";

  return (
    <div className="container relative min-h-[calc(100vh-4rem)] flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0 bg-background text-foreground">
      {/* Left Branding Hero Column (Warm Espresso & Terracotta) */}
      <div className="relative hidden h-full flex-col bg-[#161311] p-10 text-[#FAF7F2] lg:flex justify-between overflow-hidden border-r border-stone-800">
        {/* Subtle warm glow circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-amber-600/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-20 flex items-center text-lg font-bold gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-black shadow-md">
            P
          </div>
          <span className="text-xl font-serif font-black tracking-tight text-white">Peshkar AI</span>
        </div>

        <div className="relative z-20 my-auto max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5" />
            <span>{t.auth.trialBadge}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black font-serif tracking-tight leading-tight text-white">
            {t.auth.heroSubtitle}
          </h2>

          <ul className="space-y-3.5 text-xs sm:text-sm text-stone-300">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.auth.perk1}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.auth.perk2}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.auth.perk3}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.auth.perk4}</span>
            </li>
          </ul>

          <div className="pt-4 border-t border-stone-800 flex items-center gap-2.5 text-xs text-stone-400">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>{t.auth.trustText}</span>
          </div>
        </div>

        <div className="relative z-20 text-xs text-stone-500">
          {t.auth.copyright}
        </div>
      </div>

      {/* Right Form Column */}
      <div className="p-8 flex items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[420px]">
          <SignUp
            routing="path"
            path="/signup"
            signInUrl="/login"
            fallbackRedirectUrl="/app/dashboard"
            appearance={{
              variables: {
                colorPrimary: "#E05822",
                colorBackground: "var(--card)",
                borderRadius: "0.75rem",
              },
              elements: {
                card: "border border-border/80 shadow-lg rounded-2xl",
                formButtonPrimary: "bg-primary hover:bg-primary/90 text-white font-bold",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
