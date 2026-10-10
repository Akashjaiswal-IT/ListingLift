import type { CSSProperties, ReactNode } from "react";
import { Bookmark, Check, Heart, MessageCircle, Search, Send } from "lucide-react";
import { cn } from "~/lib/utils";
import { HERO_IMAGES, HERO_PRODUCT, pick } from "./hero-content";

/**
 * A hero tile: the raw phone photo underneath, the finished result on top.
 * The markup renders the FINAL state (result visible) so the page looks complete
 * before/without JS; the timeline hides the result and reveals it with a scan
 * line. All sizes inside the result scale with the tile via container units.
 */
export function HeroTile({
  order,
  scene,
  className,
  style,
  fontScale = 4.6,
  children,
}: {
  order: number;
  scene: "desktop" | "mobile";
  className?: string;
  style?: CSSProperties;
  fontScale?: number;
  children: ReactNode;
}) {
  return (
    <div
      data-tile={scene}
      data-order={order}
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)]",
        className
      )}
      style={{ containerType: "inline-size", ...style }}
    >
      <div className="relative h-full w-full">
        <img
          data-part="raw"
          src={HERO_IMAGES.raw}
          alt=""
          width={675}
          height={900}
          decoding="async"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          data-part="sweep"
          className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0"
        />
        <div data-part="reveal" className="absolute inset-0 overflow-hidden">
          <div data-part="reveal-inner" className="absolute inset-0" style={{ fontSize: `${fontScale}cqw` }}>
            {children}
          </div>
        </div>
        <div
          data-part="scan"
          className="absolute inset-x-0 top-0 h-[2px] bg-primary opacity-0"
          style={{ boxShadow: "0 0 14px 3px rgba(224, 88, 34, 0.65)" }}
        />
      </div>
    </div>
  );
}

function PhotoLabel({ side, children }: { side: "left" | "right"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "absolute bottom-[0.7em] rounded-full",
        side === "left" ? "left-[0.7em]" : "right-[0.7em]"
      )}
    >
      <span className="block rounded-full bg-black/70 px-[0.7em] py-[0.3em] text-[0.78em] font-semibold text-white">
        {children}
      </span>
    </span>
  );
}

export function StudioPhotoResult({
  variant,
  label,
  labelSide = "left",
}: {
  variant: "white" | "podium";
  label: string;
  labelSide?: "left" | "right";
}) {
  return (
    <div className={cn("relative h-full w-full", variant === "white" ? "bg-white" : "bg-stone-200")}>
      <img
        src={variant === "white" ? HERO_IMAGES.studioWhite : HERO_IMAGES.studioPodium}
        alt=""
        width={900}
        height={900}
        decoding="async"
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <PhotoLabel side={labelSide}>{label}</PhotoLabel>
    </div>
  );
}

export function WhatsAppResult({ isHi }: { isHi: boolean }) {
  const p = HERO_PRODUCT;
  return (
    <div className="flex h-full flex-col bg-[#EFE7DE] dark:bg-[#0B141A]">
      <div className="flex items-center gap-[0.5em] bg-[#008069] px-[0.75em] py-[0.55em] text-white dark:bg-[#1F2C34]">
        <span className="grid size-[1.9em] place-items-center rounded-full bg-white/20 text-[0.75em] font-bold">YS</span>
        <div className="leading-tight">
          <p className="text-[0.92em] font-semibold">{p.storeName}</p>
          <p className="text-[0.72em] opacity-80">online</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-[0.6em]">
        <div className="flex h-full flex-col rounded-[0.7em] rounded-tl-none bg-white p-[0.35em] shadow-sm dark:bg-[#1F2C34]">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[0.5em] bg-white">
            <img
              src={HERO_IMAGES.studioWhite}
              alt=""
              width={900}
              height={900}
              decoding="async"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="px-[0.3em] pt-[0.45em] text-[#111B21] dark:text-[#E9EDEF]">
            <p className="truncate text-[0.9em] font-semibold leading-tight">{p.title}</p>
            <p className="mt-[0.2em] text-[0.85em]">
              <b>{p.price}</b> <s className="opacity-55">{p.mrp}</s>{" "}
              <span className="font-semibold text-[#008069] dark:text-emerald-400">{pick(p.off, isHi)}</span>
            </p>
          </div>
          <div className="mt-[0.45em] truncate rounded-[0.45em] bg-[#25D366] px-[0.4em] py-[0.45em] text-center text-[0.82em] font-semibold text-white">
            {pick(p.orderCta, isHi)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstagramResult({ isHi }: { isHi: boolean }) {
  const p = HERO_PRODUCT;
  return (
    <div className="flex h-full flex-col bg-card text-foreground">
      <div className="flex items-center gap-[0.5em] px-[0.75em] py-[0.55em]">
        <span className="size-[2em] rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[0.13em]">
          <span className="grid size-full place-items-center rounded-full bg-card text-[0.7em] font-bold">YS</span>
        </span>
        <div className="leading-tight">
          <p className="text-[0.92em] font-semibold">{p.store}</p>
          <p className="text-[0.72em] text-muted-foreground">Sponsored</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-stone-200">
        <img
          src={HERO_IMAGES.studioPodium}
          alt=""
          width={900}
          height={900}
          decoding="async"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="space-y-[0.25em] px-[0.75em] py-[0.55em]">
        <div className="flex items-center gap-[0.7em]">
          <Heart className="size-[1.3em] fill-red-500 text-red-500" />
          <MessageCircle className="size-[1.3em]" />
          <Send className="size-[1.3em]" />
          <Bookmark className="ml-auto size-[1.3em]" />
        </div>
        <p className="text-[0.82em] font-semibold">{pick(p.likes, isHi)}</p>
        <p className="line-clamp-2 text-[0.8em] leading-snug">
          <b>{p.store}</b> {p.igCaption} <span className="text-sky-600 dark:text-sky-400">{p.igTags}</span>
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.7em] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

function MarketplaceBlock({ bullets = 3 }: { bullets?: number }) {
  const p = HERO_PRODUCT;
  return (
    <div className="space-y-[0.45em]">
      <SectionLabel>Meesho listing</SectionLabel>
      <p className="text-[0.95em] font-semibold leading-snug">{p.listingTitle}</p>
      <span className="inline-block rounded-full bg-muted px-[0.6em] py-[0.15em] text-[0.72em] text-muted-foreground">
        {p.category}
      </span>
      <ul className="space-y-[0.25em]">
        {p.bullets.slice(0, bullets).map((b) => (
          <li key={b} className="flex items-start gap-[0.4em] text-[0.8em]">
            <Check className="mt-[0.15em] size-[1em] shrink-0 text-emerald-500" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeoBlock({ showKeywords = true }: { showKeywords?: boolean }) {
  const p = HERO_PRODUCT;
  return (
    <div className="space-y-[0.4em]">
      <SectionLabel>Google preview</SectionLabel>
      <p className="flex items-center gap-[0.35em] text-[0.72em] text-muted-foreground">
        <Search className="size-[1em]" /> {p.seoUrl}
      </p>
      <p className="text-[0.95em] font-medium leading-snug text-blue-700 dark:text-sky-400">{p.seoTitle}</p>
      <p className="line-clamp-2 text-[0.78em] leading-snug text-muted-foreground">{p.seoMeta}</p>
      {showKeywords && (
        <div className="flex flex-wrap gap-[0.3em] pt-[0.15em]">
          {p.keywords.map((k) => (
            <span key={k} className="rounded-md border border-border px-[0.45em] py-[0.1em] text-[0.7em]">
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Wide desktop panel: marketplace listing + SEO side by side. */
export function ListingPanelResult() {
  return (
    <div className="grid h-full grid-cols-2 gap-[1.4em] bg-card p-[1.3em] text-left text-foreground">
      <MarketplaceBlock />
      <SeoBlock />
    </div>
  );
}

/** Narrow mobile tile: the same content stacked. */
export function ListingTileResult() {
  return (
    <div className="flex h-full flex-col gap-[0.8em] bg-card p-[0.85em] text-left text-foreground">
      <MarketplaceBlock bullets={2} />
      <div className="h-px bg-border" />
      <SeoBlock showKeywords={false} />
    </div>
  );
}
