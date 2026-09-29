"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Coins, PlusCircle, LayoutDashboard, History, UserCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useCreditStore } from "~/stores/useCreditStore";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";

export function Navbar() {
  const pathname = usePathname();
  const { balance } = useCreditStore();
  const { isSignedIn } = useUser();

  const navLinks = [
    { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/app/generate", label: "New Listing", icon: PlusCircle, highlight: true },
    { href: "/app/history", label: "History", icon: History },
    { href: "/pricing", label: "Pricing", icon: Sparkles },
    { href: "/app/credits", label: "Credits", icon: Coins },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-amber-500 shadow-md shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              ListingLift
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase -mt-1">
              AI E-Commerce Studio
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            if (link.highlight) {
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    size="sm"
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 font-medium px-4"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              );
            }

            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={`gap-2 text-sm font-medium ${isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right Action: Credits + Auth */}
        <div className="flex items-center gap-3">
          {/* Credit Badge */}
          <Link href="/app/credits">
            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors shadow-sm">
              <Coins className="h-4 w-4 text-amber-500 animate-pulse" />
              <span>{balance}</span>
              <span className="text-xs opacity-75 font-normal">credits</span>
            </div>
          </Link>

          {/* User state */}
          {isSignedIn ? (
            <div className="flex items-center gap-2">
              <Link href="/app/profile">
                <Button variant="ghost" size="icon" className="rounded-full" title="Seller Profile">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <UserButton />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <SignInButton mode="modal">
                <Button size="sm" variant="outline" className="font-medium">
                  Sign In
                </Button>
              </SignInButton>
              <Link href="/signup">
                <Button size="sm" className="bg-primary text-primary-foreground font-semibold">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
