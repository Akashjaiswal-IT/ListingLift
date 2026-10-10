"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Check, ImagePlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { HERO_COPY, HERO_IMAGES, HERO_STEPS, pick } from "./hero-content";
import {
  HeroTile,
  InstagramResult,
  ListingPanelResult,
  ListingTileResult,
  StudioPhotoResult,
  WhatsAppResult,
} from "./HeroTiles";

// Desktop tile slots around the headline (vw-based so the layout keeps its
// proportions from 1024px to 1920px; capped so tiles don't grow forever).
const TILE_W = "min(16vw, 280px)";
const TILE_H = "min(20vw, 350px)";
const BIG_W = "min(17vw, 300px)";
const BIG_H = "min(21.25vw, 375px)";

const DESKTOP_SLOTS: Record<"white" | "podium" | "whatsapp" | "instagram", { style: CSSProperties; rotate: number }> = {
  // top-right, fully on screen
  white: { style: { right: "2vw", top: 28, width: BIG_W, height: BIG_H }, rotate: 2 },
  // top-left, fully on screen
  podium: { style: { left: "2vw", top: 96, width: TILE_W, height: TILE_H }, rotate: -3 },
  // lower-left, inner
  whatsapp: { style: { left: "9.5vw", top: `calc(96px + ${TILE_H} + 36px)`, width: TILE_W, height: TILE_H }, rotate: 2 },
  // lower-right, inner
  instagram: { style: { right: "9.5vw", top: `calc(28px + ${BIG_H} + 36px)`, width: TILE_W, height: TILE_H }, rotate: -2 },
};

export function AnimatedHero({ isHi }: { isHi: boolean }) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Reduced motion: keep the server-rendered final state, never load GSAP.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let stop = () => {};
    // GSAP is loaded after the page is interactive so it never blocks first paint.
    Promise.all([import("gsap"), import("./hero-timeline")]).then(([{ gsap }, { startHeroAnimation }]) => {
      if (disposed) return;
      stop = startHeroAnimation(gsap, root);
    });
    return () => {
      disposed = true;
      stop();
    };
  }, []);

  const t = (c: { en: string; hi: string }) => pick(c, isHi);

  return (
    <section
      ref={rootRef}
      className="relative w-full overflow-x-clip pb-10 lg:h-[clamp(780px,56vw,900px)] lg:overflow-hidden lg:pb-0"
    >
      {/* Soft brand glow behind the studio card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[720px] max-w-full -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]"
      />

      {/* ---------- Desktop tiles around the headline ---------- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden lg:block">
        {(
          [
            ["white", 0, <StudioPhotoResult key="w" variant="white" label={t(HERO_STEPS[0]!)} />],
            ["podium", 1, <StudioPhotoResult key="p" variant="podium" label={t(HERO_STEPS[1]!)} labelSide="right" />],
            ["whatsapp", 2, <WhatsAppResult key="wa" isHi={isHi} />],
            ["instagram", 3, <InstagramResult key="ig" isHi={isHi} />],
          ] as const
        ).map(([slot, order, content]) => (
          <div key={slot} data-float className="absolute" style={DESKTOP_SLOTS[slot].style}>
            <HeroTile
              scene="desktop"
              order={order}
              className="h-full w-full"
              style={{ transform: `rotate(${DESKTOP_SLOTS[slot].rotate}deg)` }}
            >
              {content}
            </HeroTile>
          </div>
        ))}
      </div>

      {/* ---------- Center column: real text, CTAs, studio card ---------- */}
      <div className="relative z-20 mx-auto w-full max-w-xl px-4 pt-10 text-center sm:pt-14 lg:w-[min(600px,46vw)] lg:max-w-none lg:px-0 lg:pt-[clamp(56px,5vw,84px)]">
        <h1 className="font-serif text-[clamp(2.2rem,8.6vw,3.4rem)] font-black leading-[1.05] tracking-tight lg:text-[clamp(2.7rem,4.6vw,4.5rem)]">
          {t(HERO_COPY.headline)} <span className="italic text-primary">{t(HERO_COPY.headlineAccent)}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base lg:mt-5 lg:max-w-lg lg:text-lg">
          {t(HERO_COPY.subhead)}
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link href="/app/generate">
            <Button
              size="lg"
              className="h-12 gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90"
            >
              {t(HERO_COPY.ctaPrimary)}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="h-12 rounded-full bg-card px-6 text-sm font-semibold">
              {t(HERO_COPY.ctaSecondary)}
            </Button>
          </Link>
        </div>

        {/* Studio card (decorative demo of the upload → kit flow) */}
        <div aria-hidden="true" className="relative z-10 mx-auto mt-9 rounded-[1.6rem] border border-border/70 bg-card/60 p-2 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] backdrop-blur-sm lg:mt-10 lg:p-2.5">
          <div className="relative flex items-stretch gap-4 overflow-hidden rounded-[1.15rem] bg-card p-4 text-left lg:p-5">
            <div className="min-w-0 flex-1">
              {/* Title line: idle ↔ active */}
              <div className="relative h-6 text-[15px] font-semibold lg:text-base">
                <p data-hero="idle-title" className="absolute inset-0 truncate opacity-0">{t(HERO_COPY.idleTitle)}</p>
                <p data-hero="active-title" className="absolute inset-0 truncate">{t(HERO_COPY.activeTitle)}</p>
              </div>
              {/* Status area: idle hint / processing + checklist / ready chip */}
              <div className="relative mt-2 h-[76px] lg:h-[60px]">
                <p data-hero="idle-hint" className="absolute inset-0 text-sm text-muted-foreground opacity-0">
                  {t(HERO_COPY.idleHint)}
                </p>
                <div data-hero="processing" className="absolute inset-0 opacity-0">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] lg:flex lg:flex-wrap lg:gap-x-4 lg:gap-y-1.5 lg:text-[13px]">
                    <span className="col-span-2 inline-flex items-center text-muted-foreground lg:col-auto">
                      {t(HERO_COPY.processing)}
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="animate-[hero-dot_1.2s_ease-in-out_infinite]"
                          style={{ animationDelay: `${d * 0.18}s` }}
                        >
                          .
                        </span>
                      ))}
                    </span>
                    {HERO_STEPS.map((step, i) => (
                      <span key={step.en} data-check={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="relative inline-block size-3.5 shrink-0">
                          <span data-part="pending" className="absolute inset-0.5 rounded-full border-[1.5px] border-muted-foreground/60" />
                          <Check data-part="done" className="absolute inset-0 size-3.5 text-emerald-500" strokeWidth={3} />
                        </span>
                        <span data-part="label">{t(step)}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div data-hero="ready" className="absolute inset-x-0 top-0 origin-left">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="size-4" strokeWidth={3} />
                    {t(HERO_COPY.ready)}
                  </span>
                  <p className="mt-2 text-[12px] leading-snug text-muted-foreground lg:text-[13px]">
                    {t(HERO_COPY.readyNote)}
                  </p>
                </div>
              </div>
            </div>

            {/* Drop slot */}
            <div
              data-hero="slot"
              className="relative size-[76px] shrink-0 self-start overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 lg:size-[104px]"
            >
              <ImagePlus className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <img
                data-hero="slot-img"
                src={HERO_IMAGES.raw}
                alt=""
                width={675}
                height={900}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div data-hero="slot-ring" className="absolute inset-0 rounded-[10px] bg-primary/15 opacity-0 ring-2 ring-inset ring-primary" />
            </div>

            <div
              data-hero="progress"
              className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gradient-to-r from-primary to-amber-400"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>

        {/* Desktop: wide listing + SEO panel under the card, cropped by the hero's bottom edge */}
        <div aria-hidden="true" className="relative z-0 mt-8 hidden h-[340px] lg:block">
          <HeroTile scene="desktop" order={4} className="h-full w-full" fontScale={2.25}>
            <ListingPanelResult />
          </HeroTile>
        </div>
      </div>

      {/* ---------- Mobile / tablet: horizontal strip ---------- */}
      <div
        aria-hidden="true"
        data-hero="strip"
        className="relative z-10 mt-8 overflow-x-auto overscroll-x-contain [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        <div data-hero="track" className="flex w-max gap-2 px-4">
          {[
            <StudioPhotoResult key="w" variant="white" label={t(HERO_STEPS[0]!)} />,
            <StudioPhotoResult key="p" variant="podium" label={t(HERO_STEPS[1]!)} />,
            <WhatsAppResult key="wa" isHi={isHi} />,
            <InstagramResult key="ig" isHi={isHi} />,
            <ListingTileResult key="l" />,
          ].map((content, i) => (
            <HeroTile
              key={i}
              scene="mobile"
              order={i}
              className="aspect-[4/5] w-[40vw] max-w-[260px] shrink-0"
              fontScale={5.2}
            >
              {content}
            </HeroTile>
          ))}
        </div>
      </div>

      {/* Desktop-only actors: the dragged photo and the fake cursor */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 hidden lg:block">
        <div
          data-hero="source"
          className="absolute left-[11vw] top-[62%] w-[110px] opacity-0"
          style={{ transform: "rotate(-8deg)" }}
        >
          <div data-hero="source-shadow" className="absolute inset-0 rounded-xl opacity-0 shadow-[0_22px_40px_-8px_rgba(0,0,0,0.5)]" />
          <img
            src={HERO_IMAGES.raw}
            alt=""
            width={675}
            height={900}
            decoding="async"
            className="relative aspect-[4/5] w-full rounded-xl border-[3px] border-white object-cover shadow-md"
          />
        </div>
        <div data-hero="cursor" className="absolute left-0 top-0 opacity-0">
          <svg width="26" height="26" viewBox="0 0 24 24" className="drop-shadow-md">
            <path d="M3 2.5 20 11l-7.2 2.1L9.5 20z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span className="absolute left-5 top-6 whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
            {t(HERO_COPY.cursorTag)}
          </span>
        </div>
      </div>

      {/* Fade the cropped bottom edge into the page on desktop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden h-28 bg-gradient-to-t from-background to-transparent lg:block"
      />
    </section>
  );
}
