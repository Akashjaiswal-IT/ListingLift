import type { gsap as Gsap } from "gsap";

type G = typeof Gsap;
type Timeline = ReturnType<G["timeline"]>;

const DESKTOP_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
const MOBILE_QUERY = "(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)";

interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function boxOf(el: Element, root: Element): Box {
  const r = el.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  return { cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2, w: r.width, h: r.height };
}

function tilesOf(root: HTMLElement, scene: "desktop" | "mobile"): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-tile="${scene}"]`)).sort(
    (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
  );
}

const part = (tile: HTMLElement, name: string) => tile.querySelector<HTMLElement>(`[data-part="${name}"]`)!;

/** Elements of the shared studio card. */
function cardOf(root: HTMLElement) {
  const one = (name: string) => root.querySelector<HTMLElement>(`[data-hero="${name}"]`)!;
  const checks = Array.from(root.querySelectorAll<HTMLElement>("[data-check]"));
  return {
    idleTitle: one("idle-title"),
    activeTitle: one("active-title"),
    idleHint: one("idle-hint"),
    processing: one("processing"),
    ready: one("ready"),
    progress: one("progress"),
    slot: one("slot"),
    slotImg: one("slot-img"),
    slotRing: one("slot-ring"),
    pending: checks.map((c) => part(c, "pending")),
    done: checks.map((c) => part(c, "done")),
    labels: checks.map((c) => part(c, "label")),
  };
}

type Card = ReturnType<typeof cardOf>;

/** Loop start: empty drop slot, idle copy, every tile showing the raw photo. */
function resetScene(tl: Timeline, card: Card, tiles: HTMLElement[]) {
  tl.set(card.idleTitle, { autoAlpha: 1, y: 0 }, 0)
    .set(card.activeTitle, { autoAlpha: 0, y: 0 }, 0)
    .set(card.idleHint, { autoAlpha: 1, y: 0 }, 0)
    .set(card.processing, { autoAlpha: 0, y: 0 }, 0)
    .set(card.ready, { autoAlpha: 0, scale: 0.85 }, 0)
    .set(card.progress, { scaleX: 0, autoAlpha: 1 }, 0)
    .set(card.slotImg, { autoAlpha: 0, scale: 1 }, 0)
    .set(card.slotRing, { opacity: 0 }, 0)
    .set(card.pending, { autoAlpha: 1 }, 0)
    .set(card.done, { autoAlpha: 0, scale: 0 }, 0)
    .set(card.labels, { opacity: 0.5 }, 0)
    .set(tiles.map((t) => part(t, "reveal")), { yPercent: -100 }, 0)
    .set(tiles.map((t) => part(t, "reveal-inner")), { yPercent: 100 }, 0)
    .set(tiles.map((t) => part(t, "scan")), { y: 0, opacity: 0 }, 0)
    .set(tiles.map((t) => part(t, "sweep")), { xPercent: -100, opacity: 0 }, 0);
}

/** Card switches from "drop a photo" to "processing". */
function activateCard(tl: Timeline, card: Card, at: number, progressDuration: number) {
  tl.to(card.idleTitle, { autoAlpha: 0, y: -8, duration: 0.25 }, at)
    .fromTo(card.activeTitle, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at + 0.1)
    .to(card.idleHint, { autoAlpha: 0, y: -6, duration: 0.2 }, at)
    .fromTo(card.processing, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at + 0.15)
    .to(card.progress, { scaleX: 1, duration: progressDuration, ease: "power1.inOut" }, at + 0.15);
}

/** Processing shimmer across every raw tile. */
function sweepTiles(tl: Timeline, tiles: HTMLElement[], at: number) {
  const sweeps = tiles.map((t) => part(t, "sweep"));
  tl.to(sweeps, { opacity: 1, duration: 0.15, stagger: 0.08 }, at)
    .to(sweeps, { xPercent: 260, duration: 0.85, ease: "power1.inOut", stagger: 0.08 }, at)
    .to(sweeps, { opacity: 0, duration: 0.2, stagger: 0.08 }, at + 0.7);
}

/** Tick checklist item i and wipe tile i from the raw photo to its result. */
function revealTile(tl: Timeline, card: Card, tile: HTMLElement, i: number, at: number) {
  const d = 0.75;
  tl.to(card.pending[i]!, { autoAlpha: 0, duration: 0.15 }, at)
    .to(card.done[i]!, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(3)" }, at)
    .to(card.labels[i]!, { opacity: 1, duration: 0.2 }, at)
    .to(part(tile, "reveal"), { yPercent: 0, duration: d, ease: "power2.inOut" }, at + 0.05)
    .to(part(tile, "reveal-inner"), { yPercent: 0, duration: d, ease: "power2.inOut" }, at + 0.05)
    .to(part(tile, "scan"), { opacity: 1, duration: 0.1 }, at + 0.05)
    .to(part(tile, "scan"), { y: tile.offsetHeight, duration: d, ease: "power2.inOut" }, at + 0.05)
    .to(part(tile, "scan"), { opacity: 0, duration: 0.2 }, at + d - 0.1)
    .to(tile, { scale: 1.035, duration: 0.18, yoyo: true, repeat: 1, ease: "power1.inOut" }, at + d - 0.15);
}

/** Card shows the green "Kit ready" chip. */
function finishCard(tl: Timeline, card: Card, at: number) {
  tl.to(card.processing, { autoAlpha: 0, y: -6, duration: 0.25 }, at)
    .to(card.ready, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(2.5)" }, at + 0.1)
    .to(card.progress, { autoAlpha: 0, duration: 0.3 }, at + 0.1);
}

/** Fade back to an idle card so the loop restarts without a pop. */
function outro(tl: Timeline, card: Card, at: number) {
  tl.to([card.ready, card.activeTitle, card.slotImg], { autoAlpha: 0, duration: 0.4 }, at + 0.1)
    .fromTo(card.idleTitle, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at + 0.45)
    .fromTo(card.idleHint, { autoAlpha: 0, y: 0 }, { autoAlpha: 1, duration: 0.35 }, at + 0.5);
}

function buildDesktop(gsap: G, root: HTMLElement): Timeline {
  const card = cardOf(root);
  const tiles = tilesOf(root, "desktop");
  const source = root.querySelector<HTMLElement>('[data-hero="source"]')!;
  const sourceShadow = root.querySelector<HTMLElement>('[data-hero="source-shadow"]')!;
  const cursor = root.querySelector<HTMLElement>('[data-hero="cursor"]')!;
  const rotations = tiles.map((t) => Number(gsap.getProperty(t, "rotation")) || 0);

  const S = boxOf(source, root);
  const T = boxOf(card.slot, root);
  const rootH = root.getBoundingClientRect().height;
  const grab = { x: S.cx - 4, y: S.cy + 6 };
  const enter = { x: S.cx - 240, y: rootH + 40 };
  const dx = T.cx - S.cx;
  const dy = T.cy - S.cy;

  const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power2.out" } });
  resetScene(tl, card, tiles);
  tl.set(tiles, { autoAlpha: 0 }, 0)
    .set(source, { x: 0, y: 0, scale: 1, rotation: -8, autoAlpha: 0 }, 0)
    .set(sourceShadow, { opacity: 0 }, 0)
    .set(cursor, { x: enter.x, y: enter.y, scale: 1, autoAlpha: 1 }, 0);

  // 1. DROP — the phone photo appears, the cursor curves in (different eases on
  // x and y), grabs it, drags it into the slot and drops it.
  tl.fromTo(source, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45 }, 0.05)
    .to(cursor, { x: grab.x, duration: 1.1, ease: "power2.inOut" }, 0.2)
    .to(cursor, { y: grab.y, duration: 1.1, ease: "power3.out" }, 0.2)
    .to(cursor, { scale: 0.86, duration: 0.12 }, 1.3)
    .to(source, { scale: 1.08, rotation: -3, duration: 0.3, ease: "back.out(2)" }, 1.3)
    .to(sourceShadow, { opacity: 1, duration: 0.3 }, 1.3)
    .to(source, { x: dx, y: dy, rotation: 0, scale: T.w / S.w, duration: 1, ease: "power2.inOut" }, 1.6)
    .to(cursor, { x: grab.x + dx, y: grab.y + dy, duration: 1, ease: "power2.inOut" }, 1.6)
    .to(card.slotRing, { opacity: 1, duration: 0.25 }, 2.15)
    .to(source, { autoAlpha: 0, duration: 0.18 }, 2.6)
    .fromTo(card.slotImg, { autoAlpha: 0, scale: 1.15 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(2.4)" }, 2.6)
    .to(card.slotRing, { opacity: 0, duration: 0.4 }, 2.75)
    .to(cursor, { scale: 1, duration: 0.12 }, 2.6)
    .to(cursor, { x: grab.x + dx + 70, y: grab.y + dy + 60, autoAlpha: 0, duration: 0.5, ease: "power1.in" }, 2.75);

  // 2. MULTIPLY — copies of the photo fly out of the drop slot to every tile slot.
  activateCard(tl, card, 2.75, 5.9);
  tiles.forEach((tile, i) => {
    const B = boxOf(tile, root);
    const at = 2.9 + i * 0.09;
    tl.fromTo(
      tile,
      { x: T.cx - B.cx, y: T.cy - B.cy, scale: Math.min(T.w / B.w, T.h / B.h), rotation: 0 },
      { x: 0, y: 0, scale: 1, rotation: rotations[i], duration: 1.05, ease: "power3.out", immediateRender: false },
      at
    ).to(tile, { autoAlpha: 1, duration: 0.2 }, at);
  });

  // 3. PROCESSING — shimmer over the raw copies.
  sweepTiles(tl, tiles, 3.9);

  // 4. REVEAL — one checklist tick, one tile transformed.
  tiles.forEach((tile, i) => revealTile(tl, card, tile, i, 4.8 + i * 0.8));

  // 5. READY — hold, then fade out and loop.
  finishCard(tl, card, 8.75);
  tl.addLabel("hold", 9.4);
  tl.to(tiles, { autoAlpha: 0, scale: 0.96, duration: 0.5, stagger: 0.05, ease: "power1.in" }, 11.6);
  outro(tl, card, 11.6);

  // Gentle idle float on the outer wrappers (independent of the main loop).
  root.querySelectorAll<HTMLElement>("[data-float]").forEach((el, i) => {
    gsap.to(el, { y: i % 2 ? 7 : -7, duration: 4 + i * 0.7, ease: "sine.inOut", yoyo: true, repeat: -1 });
  });

  return tl;
}

function buildMobile(gsap: G, root: HTMLElement): Timeline {
  const card = cardOf(root);
  const tiles = tilesOf(root, "mobile");
  const strip = root.querySelector<HTMLElement>('[data-hero="strip"]')!;
  const track = root.querySelector<HTMLElement>('[data-hero="track"]')!;
  const maxShift = Math.max(0, track.scrollWidth - strip.clientWidth);
  // Shift the strip so the tile being revealed is in view (keep a peek of the previous one).
  const shiftFor = (tile: HTMLElement) =>
    -Math.min(maxShift, Math.max(0, tile.offsetLeft - tile.offsetWidth * 0.45));

  const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power2.out" } });
  resetScene(tl, card, tiles);
  tl.set(track, { x: 0, autoAlpha: 1 }, 0);

  tl.fromTo(card.slotImg, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: "back.out(2.2)" }, 0.35)
    .fromTo(card.slotRing, { opacity: 0 }, { opacity: 1, duration: 0.2, yoyo: true, repeat: 1 }, 0.3);
  activateCard(tl, card, 0.7, 5.6);
  sweepTiles(tl, tiles, 1.0);

  let currentShift = 0;
  tiles.forEach((tile, i) => {
    const at = 1.8 + i * 0.95;
    const shift = shiftFor(tile);
    if (shift !== currentShift) {
      tl.to(track, { x: shift, duration: 0.6, ease: "power2.inOut" }, at - 0.35);
      currentShift = shift;
    }
    revealTile(tl, card, tile, i, at);
  });

  finishCard(tl, card, 6.4);
  // Glide back to the first tile so the finished frame matches the server markup.
  tl.to(track, { x: 0, duration: 1.1, ease: "power2.inOut" }, 6.6);
  tl.addLabel("hold", 7.8);
  tl.to(track, { autoAlpha: 0, duration: 0.45, ease: "power1.in" }, 9.6);
  outro(tl, card, 9.6);
  tl.to(track, { autoAlpha: 1, duration: 0.01 }, 10.3);

  return tl;
}

/**
 * Starts the looping hero animation and returns a cleanup function.
 * Pauses when the hero is off-screen, the tab is hidden, or (mobile) while the
 * user is touching the strip. Rebuilds on breakpoint and width changes.
 */
export function startHeroAnimation(gsap: G, root: HTMLElement): () => void {
  let tl: Timeline | null = null;
  let onScreen = true;
  let touching = false;
  let touchTimer: number | undefined;

  const sync = () => {
    if (!tl) return;
    if (onScreen && !document.hidden && !touching) tl.resume();
    else tl.pause();
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      onScreen = !!entry?.isIntersecting;
      sync();
    },
    { threshold: 0.05 }
  );
  io.observe(root);
  document.addEventListener("visibilitychange", sync);

  const strip = root.querySelector<HTMLElement>('[data-hero="strip"]');
  const onTouchStart = () => {
    window.clearTimeout(touchTimer);
    touching = true;
    sync();
  };
  const onTouchEnd = () => {
    window.clearTimeout(touchTimer);
    touchTimer = window.setTimeout(() => {
      touching = false;
      sync();
    }, 2000);
  };
  strip?.addEventListener("touchstart", onTouchStart, { passive: true });
  strip?.addEventListener("touchend", onTouchEnd, { passive: true });
  strip?.addEventListener("touchcancel", onTouchEnd, { passive: true });

  const mm = gsap.matchMedia();
  mm.add({ desktop: DESKTOP_QUERY, mobile: MOBILE_QUERY }, (context) => {
    const isDesktop = Boolean(context.conditions?.desktop);
    let scoped: ReturnType<G["context"]> | null = null;

    const build = () => {
      scoped?.revert();
      scoped = gsap.context(() => {
        tl = isDesktop ? buildDesktop(gsap, root) : buildMobile(gsap, root);
        // Start on the finished frame - it matches the server-rendered markup,
        // so there is no visual jump when the animation takes over.
        tl.play("hold");
        sync();
        // Dev-only handle so the loop can be scrubbed frame by frame while polishing.
        if (process.env.NODE_ENV !== "production") (root as HTMLElement & { __heroTl?: Timeline }).__heroTl = tl;
      }, root);
    };
    build();

    let width = root.offsetWidth;
    let resizeTimer: number | undefined;
    const ro = new ResizeObserver(() => {
      if (root.offsetWidth === width) return;
      width = root.offsetWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 200);
    });
    ro.observe(root);

    return () => {
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      scoped?.revert();
      tl = null;
    };
  });

  return () => {
    mm.revert();
    io.disconnect();
    document.removeEventListener("visibilitychange", sync);
    window.clearTimeout(touchTimer);
    strip?.removeEventListener("touchstart", onTouchStart);
    strip?.removeEventListener("touchend", onTouchEnd);
    strip?.removeEventListener("touchcancel", onTouchEnd);
  };
}
