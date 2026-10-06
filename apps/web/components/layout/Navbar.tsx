"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Coins,
  PlusCircle,
  LayoutDashboard,
  History,
  UserCheck,
  Sun,
  Moon,
  HelpCircle,
  Globe,
  Menu,
  X,
  ShoppingBag,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useCreditStore } from "~/stores/useCreditStore";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
import { trpc } from "~/trpc/client";
import { useLanguage } from "~/providers/LanguageContext";
import { useTheme } from "next-themes";

export function Navbar() {
  const pathname = usePathname();
  const { balance, setBalance, isInitialized } = useCreditStore();
  const { isSignedIn } = useUser();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const creditQuery = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!isSignedIn,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (creditQuery.data?.balance !== undefined) {
      setBalance(creditQuery.data.balance);
    }
  }, [creditQuery.data?.balance, setBalance]);

  const navLinks = [
    { href: "/", label: t.nav.home },
    { href: "/app/dashboard", label: t.nav.dashboard },
    { href: "/app/history", label: t.nav.myProducts },
    { href: "/pricing", label: t.nav.pricing },
    { href: "/app/credits", label: t.nav.credits },
  ];

  const handleTriggerTour = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-peshkar-tour"));
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-md transition-colors">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo - Orange Square with white 'P' */}
        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-[1.01]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-xl shadow-sm shadow-primary/20 shrink-0">
            P
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-foreground font-serif leading-none">
              Peshkar AI
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mt-0.5">
              {language === "hi" ? "AI ई-कॉमर्स स्टूडियो" : "AI E-Commerce Studio"}
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs font-semibold px-3 transition-colors ${
                    isActive
                      ? "text-primary font-bold bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right Action: Language + Theme + Tour + Credits + Auth + CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher (Hindi Default / English) */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-full border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setLanguage("hi")}
              className={`px-2.5 py-1 rounded-full font-bold transition-all text-xs ${
                language === "hi"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="हिंदी में बदलें"
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2.5 py-1 rounded-full font-bold transition-all text-xs ${
                language === "en"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Switch to English"
            >
              EN
            </button>
          </div>

          {/* Theme Toggle (Light default / Dark) */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}

          {/* Onboarding Tour Help Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTriggerTour}
            className="hidden sm:inline-flex h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
            title={t.tour.takeTourBtn}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Credit Badge (when signed in). Turns into a red "top up" cue when
              the balance falls below the cheapest generation (2 credits), and
              routes to /pricing instead of the ledger so the user can act. */}
          {isSignedIn &&
            (() => {
              const isLow = isInitialized && balance < 2;
              return (
                <Link href={isLow ? "/pricing" : "/app/credits"}>
                  <div
                    className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors shadow-xs ${
                      isLow
                        ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                    }`}
                    title={isLow ? (language === "hi" ? "क्रेडिट कम हैं — टॉप अप करें" : "Low credits — top up") : undefined}
                  >
                    <Coins className={`h-3.5 w-3.5 ${isLow ? "text-destructive" : "text-amber-500"}`} />
                    <span>{isInitialized ? balance : creditQuery.isLoading ? "..." : balance}</span>
                    <span className="text-[10px] opacity-75 font-normal">
                      {isLow ? (language === "hi" ? "टॉप अप करें" : "Top up") : t.nav.creditsRemaining}
                    </span>
                  </div>
                </Link>
              );
            })()}

          {/* User state / Sign In */}
          {isSignedIn ? (
            <div className="flex items-center gap-2">
              <Link href="/app/profile">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground" title={t.nav.profile}>
                  <UserCheck className="h-4 w-4" />
                </Button>
              </Link>
              <UserButton />
            </div>
          ) : (
            <SignInButton mode="modal">
              <Button size="sm" variant="outline" className="font-semibold text-xs h-9 px-3.5 border-border">
                {t.nav.login}
              </Button>
            </SignInButton>
          )}

          {/* Primary CTA Button - "Start Revamping" */}
          <Link href="/app/generate" className="hidden sm:inline-block">
            <Button
              size="sm"
              className="h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm text-xs gap-1.5 transition-transform hover:scale-[1.02]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.nav.startRevamping}
            </Button>
          </Link>

          {/* Mobile Menu Hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden h-9 w-9 text-muted-foreground"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-card p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <Link href="/app/generate" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs gap-2">
                <Sparkles className="h-4 w-4" /> {t.nav.startRevamping}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
