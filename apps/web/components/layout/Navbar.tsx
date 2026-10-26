"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles, Coins, UserCheck, Sun, Moon, HelpCircle, Menu, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useCreditStore } from "~/stores/useCreditStore";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
import { trpc } from "~/trpc/client";
import { useLanguage } from "~/providers/LanguageContext";
import { useTheme } from "next-themes";
import { IrisMark } from "~/components/brand/PeshkarLogo";

export function Navbar() {
  const pathname = usePathname();
  const { balance, setBalance, isInitialized } = useCreditStore();
  const { isSignedIn } = useUser();
  const { t, language, setLanguage } = useLanguage();
  const isHi = language === "hi";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && !!pathname?.startsWith(`${href}/`)) ||
    // a listing / re-edit page belongs to "My Products"
    (href === "/app/history" && (!!pathname?.startsWith("/app/listing/") || !!pathname?.startsWith("/app/re-edit/")));

  const handleTriggerTour = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-peshkar-tour"));
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const themeLabel =
    theme === "dark"
      ? isHi ? "लाइट मोड चालू करें" : "Switch to light mode"
      : isHi ? "डार्क मोड चालू करें" : "Switch to dark mode";

  const isLow = isInitialized && balance < 2;
  const balanceText = isInitialized ? balance : creditQuery.isLoading ? "…" : balance;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-md transition-colors">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        {/* Brand Logo - Camera iris mark + wordmark */}
        <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3" aria-label="Peshkar AI — home">
          <IrisMark size={36} className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
          <div className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap text-base min-[360px]:text-lg sm:text-xl font-black tracking-tight text-foreground font-serif leading-none">
              Peshkar AI
            </span>
            <span className="hidden sm:block whitespace-nowrap text-xs font-semibold tracking-wider text-muted-foreground uppercase mt-0.5">
              {isHi ? "AI ई-कॉमर्स स्टूडियो" : "AI E-Commerce Studio"}
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-1" aria-label={isHi ? "मुख्य नेविगेशन" : "Main navigation"}>
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Button
                key={link.href}
                asChild
                variant="ghost"
                size="sm"
                className={`text-sm font-semibold px-3 transition-colors ${
                  active
                    ? "text-primary font-bold bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Link href={link.href} aria-current={active ? "page" : undefined}>
                  {link.label}
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* Right Action: Language + Theme + Tour + Credits + Auth + CTA */}
        <div className="flex shrink-0 items-center gap-1 min-[380px]:gap-1.5 sm:gap-3">
          {/* Language Switcher (Hindi default / English) */}
          <div
            role="group"
            aria-label={isHi ? "भाषा" : "Language"}
            className="flex items-center bg-muted/60 p-0.5 rounded-full border border-border/60 text-xs"
          >
            <button
              type="button"
              lang="hi"
              onClick={() => setLanguage("hi")}
              aria-pressed={isHi}
              className={`px-2 sm:px-2.5 py-1.5 rounded-full font-bold transition-all text-xs ${
                isHi ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="हिंदी में बदलें"
            >
              हिन्दी
            </button>
            <button
              type="button"
              lang="en"
              onClick={() => setLanguage("en")}
              aria-pressed={!isHi}
              className={`px-2 sm:px-2.5 py-1.5 rounded-full font-bold transition-all text-xs ${
                !isHi ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Switch to English"
            >
              EN
            </button>
          </div>

          {/* Theme Toggle (Light default / Dark) - in the menu on phones */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="hidden sm:inline-flex h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={themeLabel}
              title={themeLabel}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-credit" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}

          {/* Onboarding Tour Help Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTriggerTour}
            className="hidden sm:inline-flex h-9 w-9 rounded-full text-muted-foreground hover:text-primary"
            aria-label={t.tour.takeTourBtn}
            title={t.tour.takeTourBtn}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Credit balance (signed in). Visible on every screen size; turns into a
              red "top up" cue below the cheapest generation (2 credits) and then
              routes to /pricing instead of the ledger so the user can act. */}
          {isSignedIn && (
            <Link
              href={isLow ? "/pricing" : "/app/credits"}
              aria-label={
                isLow
                  ? isHi ? `${balanceText} क्रेडिट — क्रेडिट कम हैं, टॉप अप करें` : `${balanceText} credits — low, top up`
                  : isHi ? `${balanceText} क्रेडिट शेष` : `${balanceText} credits remaining`
              }
              className={`flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-colors shadow-xs ${
                isLow
                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-credit/30 bg-credit/10 text-credit hover:bg-credit/20"
              }`}
            >
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{balanceText}</span>
              <span className="hidden sm:inline font-normal">
                {isLow ? (isHi ? "टॉप अप करें" : "Top up") : t.nav.creditsRemaining}
              </span>
            </Link>
          )}

          {/* User state / Sign In */}
          {isSignedIn ? (
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex rounded-full h-9 w-9 text-muted-foreground"
              >
                <Link href="/app/profile" aria-label={t.nav.profile} title={t.nav.profile}>
                  <UserCheck className="h-4 w-4" />
                </Link>
              </Button>
              <UserButton />
            </div>
          ) : (
            <SignInButton mode="modal">
              <Button size="sm" variant="outline" className="font-semibold text-xs h-9 px-2.5 sm:px-3.5 border-border">
                {t.nav.login}
              </Button>
            </SignInButton>
          )}

          {/* Primary CTA Button - "Start Revamping" */}
          <Button
            asChild
            size="sm"
            className="hidden sm:inline-flex h-9 px-4 font-bold rounded-xl shadow-sm text-xs gap-1.5"
          >
            <Link href="/app/generate">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t.nav.startRevamping}
            </Link>
          </Button>

          {/* Mobile Menu Hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={isHi ? "मेनू" : "Menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            className="lg:hidden h-9 w-9 text-muted-foreground"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          className="lg:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-card p-4 space-y-3 motion-safe:animate-in motion-safe:slide-in-from-top-2 duration-200"
        >
          <nav className="flex flex-col gap-1" aria-label={isHi ? "मुख्य नेविगेशन" : "Main navigation"}>
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-base font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {isSignedIn && (
              <Link
                href="/app/profile"
                aria-current={pathname === "/app/profile" ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-base font-semibold text-foreground hover:bg-muted/60"
              >
                {t.nav.profile}
              </Link>
            )}
          </nav>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setMobileMenuOpen(false);
                handleTriggerTour();
              }}
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              {t.tour.takeTourBtn}
            </Button>
            {mounted && (
              <Button variant="outline" size="sm" className="gap-2" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                {themeLabel}
              </Button>
            )}
          </div>

          <div className="pt-3 border-t border-border">
            <Button asChild className="w-full h-11 font-bold text-sm gap-2">
              <Link href="/app/generate" onClick={() => setMobileMenuOpen(false)}>
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {t.nav.startRevamping}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
