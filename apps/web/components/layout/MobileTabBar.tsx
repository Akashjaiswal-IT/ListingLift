"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, LayoutDashboard, Package, Plus } from "lucide-react";
import { useCreditStore } from "~/stores/useCreditStore";
import { useLanguage } from "~/providers/LanguageContext";

/**
 * Phone-only bottom navigation for the signed-in app (/app/*): the four places a
 * seller goes most, reachable with a thumb, with the credit balance always in view.
 */
export function MobileTabBar() {
  const pathname = usePathname() || "";
  const { t, language } = useLanguage();
  const isHi = language === "hi";
  const { balance, isInitialized } = useCreditStore();

  const items = [
    { href: "/app/dashboard", label: t.nav.dashboard, icon: LayoutDashboard, match: ["/app/dashboard"] },
    { href: "/app/history", label: t.nav.myProducts, icon: Package, match: ["/app/history", "/app/listing", "/app/re-edit"] },
    { href: "/app/credits", label: t.nav.credits, icon: Coins, match: ["/app/credits"] },
  ];
  const isActive = (match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  const createActive = pathname.startsWith("/app/generate");

  const tab = (item: (typeof items)[number]) => {
    const active = isActive(item.match);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <span className="relative">
          <Icon className="h-5 w-5" aria-hidden="true" />
          {item.href === "/app/credits" && isInitialized && (
            <span
              className={`absolute -right-3 -top-2 min-w-5 rounded-full px-1 text-center text-xs font-bold leading-4 ${
                balance < 2 ? "bg-destructive text-white" : "bg-credit text-white dark:text-black"
              }`}
              aria-label={isHi ? `${balance} क्रेडिट` : `${balance} credits`}
            >
              {balance}
            </span>
          )}
        </span>
        <span className="max-w-full truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={isHi ? "ऐप नेविगेशन" : "App navigation"}
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        {tab(items[0]!)}
        {tab(items[1]!)}
        <Link
          href="/app/generate"
          aria-current={createActive ? "page" : undefined}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold text-primary"
        >
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
            <Plus className="h-6 w-6" aria-hidden="true" />
          </span>
          <span>{isHi ? "बनाएं" : "Create"}</span>
        </Link>
        {tab(items[2]!)}
      </div>
    </nav>
  );
}
