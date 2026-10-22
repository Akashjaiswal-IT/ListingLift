"use client";

import { useId } from "react";

/**
 * The Peshkar AI brand mark: a six-blade camera iris closing around a
 * hexagonal lens with an AI spark at its centre. The iris geometry is fixed
 * (a hexagon of radius 0.35R with each edge extended to a circle of radius R,
 * cutting the ring into six tiling blades) and baked in as path data so the
 * mark renders identically everywhere — navbar, footer, auth, favicon, app
 * icon. Do not edit the path data by hand; regenerate it if the geometry
 * changes. The single source of truth for the logo across the app.
 */

const VIEWBOX = 96;

// Blades, shaded by each blade's angle to an upper-left light source.
const BLADES = [
  { d: "M59.49,44.92 L78.2,63.62 A34,34 0 0 1 49.57,81.96 L56.41,56.41 Z", op: 0.49 },
  { d: "M56.41,56.41 L49.57,81.96 A34,34 0 0 1 19.37,66.34 L44.92,59.49 Z", op: 0.66 },
  { d: "M44.92,59.49 L19.37,66.34 A34,34 0 0 1 17.8,32.38 L36.51,51.08 Z", op: 0.92 },
  { d: "M36.51,51.08 L17.8,32.38 A34,34 0 0 1 46.43,14.04 L39.59,39.59 Z", op: 0.99 },
  { d: "M39.59,39.59 L46.43,14.04 A34,34 0 0 1 76.63,29.66 L51.08,36.51 Z", op: 0.82 },
  { d: "M51.08,36.51 L76.63,29.66 A34,34 0 0 1 78.2,63.62 L59.49,44.92 Z", op: 0.56 },
];

// Lines that separate the blades, stroked onto the mask to carve the gaps.
const CUTS = [
  "M59.14,44.57 L80.32,65.74",
  "M56.54,55.93 L48.79,84.86",
  "M45.4,59.37 L16.47,67.12",
  "M36.86,51.43 L15.68,30.26",
  "M39.46,40.07 L47.21,11.14",
  "M50.6,36.63 L79.53,28.88",
];

const SPARK =
  "M48,40.62 Q48,48 55.38,48 Q48,48 48,55.38 Q48,48 40.62,48 Q48,48 48,40.62 Z";

export type IrisVariant = "color" | "mono" | "onBrand";

interface IrisMarkProps {
  size?: number;
  /** color = gradient terracotta tile; mono = ink tile; onBrand = translucent tile for use on the brand gradient */
  variant?: IrisVariant;
  /** Drop the spark and widen the blade gaps for small sizes (<= 24px). */
  small?: boolean;
  className?: string;
  title?: string;
}

/** The icon tile on its own — app icon, favicon, avatar. */
export function IrisMark({
  size = 36,
  variant = "color",
  small = false,
  className,
  title = "Peshkar AI",
}: IrisMarkProps) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `pk-bg-${id}`;
  const hlId = `pk-hl-${id}`;
  const maskId = `pk-mask-${id}`;

  const tileFill = variant === "mono" ? "#191614" : `url(#${gradId})`;
  const bladeFill =
    variant === "mono" ? "#F3ECE2" : variant === "onBrand" ? "#FFFFFF" : "#FFFFFF";
  const sparkFill = variant === "mono" ? "#E05822" : "#FFFFFF";
  const gap = small ? 5 : 2.6;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F07A4A" />
          <stop offset="0.55" stopColor="#E05822" />
          <stop offset="1" stopColor="#C94917" />
        </linearGradient>
        <linearGradient id={hlId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="8" y="8" width="80" height="80">
          <rect x="8" y="8" width="80" height="80" fill="#fff" />
          <path d={CUTS.join(" ")} stroke="#000" strokeWidth={gap} fill="none" />
        </mask>
      </defs>

      <rect width={VIEWBOX} height={VIEWBOX} rx="22" fill={tileFill} />
      {variant !== "mono" && (
        <rect width={VIEWBOX} height={VIEWBOX} rx="22" fill={`url(#${hlId})`} />
      )}

      <g mask={`url(#${maskId})`}>
        {BLADES.map((b, i) => (
          <path key={i} d={b.d} fill={bladeFill} fillOpacity={b.op} />
        ))}
      </g>

      {!small && <path d={SPARK} fill={sparkFill} />}
    </svg>
  );
}

interface LogoProps {
  /** Icon tile pixel size. */
  size?: number;
  variant?: IrisVariant;
  /** Show the "Peshkar AI" wordmark beside the mark. */
  showWordmark?: boolean;
  /** Show the small "E-Commerce Studio" tagline under the wordmark. */
  showTagline?: boolean;
  /** Tailwind text color class for the wordmark (e.g. "text-white"). */
  wordmarkClassName?: string;
  className?: string;
}

/**
 * The full horizontal lockup: iris mark + "Peshkar AI" wordmark, with an
 * optional tagline. Use this in the navbar, footer and auth pages so the
 * lockup is identical everywhere.
 */
export function Logo({
  size = 36,
  variant = "color",
  showWordmark = true,
  showTagline = false,
  wordmarkClassName = "text-foreground",
  className,
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <IrisMark size={size} variant={variant} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-serif font-black tracking-tight ${wordmarkClassName}`}
            style={{ fontSize: Math.round(size * 0.58) }}
          >
            Peshkar <span className="font-sans font-extrabold text-primary">AI</span>
          </span>
          {showTagline && (
            <span className="mt-1 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              E-Commerce Studio
            </span>
          )}
        </span>
      )}
    </span>
  );
}
