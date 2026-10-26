"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Camera } from "lucide-react";
import { Badge } from "~/components/ui/badge";

interface BeforeAfterSliderProps {
  beforeImage?: string;
  afterImage?: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeSubtitle?: string;
  afterSubtitle?: string;
  className?: string;
}

export function BeforeAfterSlider({
  beforeImage = "/images/hero-before.webp",
  afterImage = "/images/hero-after.webp",
  beforeLabel = "Raw Phone Photo",
  afterLabel = "AI Studio Revamp",
  beforeSubtitle = "Casual photo on bed",
  afterSubtitle = "Upright Studio Lighting",
  className = "",
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const handlePointerDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging, handleMove]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setSliderPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      setSliderPos((prev) => Math.min(100, prev + 5));
    }
  };

  // Linear fade: AFTER badge 1 at <=70 -> 0 at >=85; BEFORE badge 1 at >=30 -> 0 at <=15
  const afterOpacity = Math.max(0, Math.min(1, (85 - sliderPos) / 15));
  const beforeOpacity = Math.max(0, Math.min(1, (sliderPos - 15) / 15));

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-valuenow={Math.round(sliderPos)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Image comparison slider"
        tabIndex={0}
        className="relative aspect-square sm:aspect-[4/3] lg:aspect-square w-full rounded-2xl overflow-hidden select-none cursor-ew-resize border-2 border-stone-800 bg-stone-950 shadow-2xl focus:outline-hidden focus:ring-2 focus:ring-primary/60 group"
      >
        {/* AFTER IMAGE (Base Layer: Studio) */}
        <div className="absolute inset-0 w-full h-full bg-stone-900">
          <img
            src={afterImage}
            alt={afterLabel}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover filter drop-shadow-2xl"
            draggable={false}
          />
        </div>

        {/* BEFORE IMAGE (Clipped Layer: Raw Phone Photo) */}
        <div
          className="absolute inset-0 w-full h-full bg-stone-950 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={beforeImage}
            alt={beforeLabel}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover filter brightness-90 contrast-95"
            draggable={false}
          />
        </div>

        {/* BADGES: above both images, below the divider. Each fades out when its side is mostly hidden */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div
            className="absolute top-3 left-3 transition-opacity duration-150"
            style={{ opacity: beforeOpacity }}
            aria-hidden={beforeOpacity === 0}
          >
            <Badge
              variant="secondary"
              className="bg-stone-900/90 text-stone-200 text-[10px] font-bold border border-stone-700 shadow-md backdrop-blur-xs flex items-center gap-1 px-2.5 py-1"
            >
              <Camera className="h-3 w-3 text-stone-400" />
              {beforeLabel}
            </Badge>
          </div>
          <div
            className="absolute top-3 right-3 transition-opacity duration-150"
            style={{ opacity: afterOpacity }}
            aria-hidden={afterOpacity === 0}
          >
            <Badge className="bg-primary/95 text-white text-[10px] font-black tracking-wide border-none shadow-md backdrop-blur-xs flex items-center gap-1 px-2.5 py-1">
              <Sparkles className="h-3 w-3" />
              {afterLabel}
            </Badge>
          </div>
        </div>

        {/* SLIDER DIVIDER LINE & HANDLE */}
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.6)]"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white text-stone-900 shadow-2xl flex items-center justify-center border-2 border-primary ring-4 ring-black/40 transition-transform group-hover:scale-110 active:scale-95">
            <div className="flex items-center text-[11px] font-black tracking-tighter">
              <span>◀</span>
              <span>▶</span>
            </div>
          </div>
        </div>

        {/* Hint Pill at bottom center */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span className="text-[10px] font-bold text-white/80 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 uppercase tracking-wider">
            Drag Slider to Compare
          </span>
        </div>
      </div>

      {/* Subtitles & Descriptions below slider */}
      <div className="flex items-center justify-between text-xs px-1 text-stone-400 font-medium">
        <span className="flex items-center gap-1.5 text-stone-400">
          <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
          {beforeSubtitle}
        </span>
        <span className="flex items-center gap-1.5 text-primary font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {afterSubtitle}
        </span>
      </div>
    </div>
  );
}
