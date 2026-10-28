"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useLanguage } from "~/providers/LanguageContext";
import { useUser } from "@clerk/nextjs";
import { Camera, Sparkles, ShoppingBag, ShieldCheck, ArrowRight, ArrowLeft, X } from "lucide-react";
import Link from "next/link";

export function OnboardingTour() {
  const { isSignedIn } = useUser();
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    try {
      const tourSeen = localStorage.getItem("peshkar_tour_seen") || localStorage.getItem("listinglift_tour_seen");
      if (!tourSeen) {
        // First time login/signup: launch tour automatically after a gentle 1.2s delay
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [isSignedIn]);

  // Allow other components to trigger the tour manually
  useEffect(() => {
    const handleOpenTour = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };
    window.addEventListener("open-peshkar-tour", handleOpenTour);
    window.addEventListener("open-listinglift-tour", handleOpenTour);
    return () => {
      window.removeEventListener("open-peshkar-tour", handleOpenTour);
      window.removeEventListener("open-listinglift-tour", handleOpenTour);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    try {
      localStorage.setItem("peshkar_tour_seen", "true");
    } catch {}
  };

  const steps = [
    {
      title: t.tour.step1Title,
      desc: t.tour.step1Desc,
      icon: Camera,
      tag: language === "hi" ? "स्टेप 1" : "Step 1",
      badge: "Raw Phone Photo",
    },
    {
      title: t.tour.step2Title,
      desc: t.tour.step2Desc,
      icon: Sparkles,
      tag: language === "hi" ? "स्टेप 2" : "Step 2",
      badge: "Pure White (#FFFFFF)",
    },
    {
      title: t.tour.step3Title,
      desc: t.tour.step3Desc,
      icon: ShoppingBag,
      tag: language === "hi" ? "स्टेप 3" : "Step 3",
      badge: "Marketplace Kit",
    },
    {
      title: t.tour.step4Title,
      desc: t.tour.step4Desc,
      icon: ShieldCheck,
      tag: language === "hi" ? "स्टेप 4" : "Step 4",
      badge: "Auto-Refund Protection",
    },
  ];

  const step = steps[currentStep]!;
  const Icon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md p-0 overflow-hidden border border-border/70 bg-card rounded-2xl shadow-2xl"
      >
        <DialogTitle className="sr-only">{t.tour.welcomeTitle}</DialogTitle>

        {/* Main Content Area */}
        <div className="relative p-6 sm:p-7 bg-gradient-to-br from-primary via-primary/95 to-amber-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-white/20 text-white border-white/30 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm px-2.5 py-0.5">
              {step.tag} / {steps.length}
            </Badge>
            <button
              onClick={handleClose}
              className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white font-medium px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label={t.tour.skip}
            >
              <span>{t.tour.skip}</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-md backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-2 min-w-0">
              <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                {step.title}
              </h3>
              <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal">
                {step.desc}
              </p>
              <div className="pt-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-semibold text-white/95">
                  ✓ {step.badge}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="p-4 sm:p-5 bg-card flex items-center justify-between gap-4">
          <div className="w-20">
            {currentStep > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="gap-1 text-xs text-muted-foreground font-semibold px-2 hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t.tour.prev}
              </Button>
            ) : null}
          </div>

          {/* Centered animated dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="w-28 flex justify-end">
            {currentStep < steps.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="bg-primary hover:bg-primary/90 text-white font-bold text-xs gap-1.5 px-4 shadow-sm"
              >
                {t.tour.next} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Link href="/app/generate" onClick={handleClose}>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-600 text-white font-black text-xs gap-1 px-4 shadow-sm"
                >
                  {t.tour.finish}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
