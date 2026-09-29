"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useLanguage } from "~/providers/LanguageContext";
import { useUser } from "@clerk/nextjs";
import { Camera, Sparkles, ShoppingBag, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
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
      highlight: language === "hi" ? "फोन से 1 क्लिक में फोटो खींचें" : "Simple Smartphone Photography",
      previewBadge: "Raw Phone Photo",
    },
    {
      title: t.tour.step2Title,
      desc: t.tour.step2Desc,
      icon: Sparkles,
      tag: language === "hi" ? "स्टेप 2" : "Step 2",
      highlight: language === "hi" ? "100% प्योर व्हाइट बैकग्राउंड गारंटी" : "Guaranteed Studio Pure White",
      previewBadge: "White Studio (#FFFFFF)",
    },
    {
      title: t.tour.step3Title,
      desc: t.tour.step3Desc,
      icon: ShoppingBag,
      tag: language === "hi" ? "स्टेप 3" : "Step 3",
      highlight: language === "hi" ? "व्हाट्सएप, मीशो व इंस्टा किट" : "WhatsApp Broadcast & Social Cards",
      previewBadge: "Ready-to-Post Kit",
    },
    {
      title: t.tour.step4Title,
      desc: t.tour.step4Desc,
      icon: ShieldCheck,
      tag: language === "hi" ? "स्टेप 4" : "Step 4",
      highlight: language === "hi" ? "ऑटोमेटेड रिफंड सुरक्षा" : "Instant Refund Guarantee",
      previewBadge: "Zero Risk",
    },
  ];

  const step = steps[currentStep]!;
  const Icon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border border-border/80 bg-card rounded-2xl shadow-2xl">
        <DialogTitle className="sr-only">{t.tour.welcomeTitle}</DialogTitle>

        {/* Top Header Card */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-br from-primary via-primary/95 to-amber-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-white/20 text-white border-white/30 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm">
              {step.tag} / 4
            </Badge>
            <button
              onClick={handleClose}
              className="text-xs text-white/80 hover:text-white font-medium transition-colors"
            >
              {t.tour.skip} ✕
            </button>
          </div>

          <div className="flex items-center gap-3.5 mb-2">
            <div className="h-11 w-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-sm backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                {step.title}
              </h3>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal mt-1">
            {step.desc}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "w-7 bg-white" : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Highlight Box */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {step.highlight}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">
              {step.previewBadge}
            </Badge>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-2">
            {currentStep > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="gap-1.5 text-xs text-muted-foreground font-semibold"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t.tour.prev}
              </Button>
            ) : (
              <div />
            )}

            {currentStep < steps.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="bg-primary hover:bg-primary/90 text-white font-bold text-xs gap-1.5 px-5 shadow-md"
              >
                {t.tour.next} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Link href="/app/generate" onClick={handleClose}>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-600 text-white font-black text-xs gap-1.5 px-6 shadow-md"
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
