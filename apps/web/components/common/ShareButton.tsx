"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { shareImagesWithCaption } from "~/lib/share";

interface ShareButtonProps {
  imageUrls: string[];
  caption?: string;
  fileBaseName?: string;
  isHi: boolean;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  onShared?: () => void;
}

/** Native share sheet with the actual image files (WhatsApp-first), with a desktop fallback. */
export function ShareButton({
  imageUrls,
  caption,
  fileBaseName,
  isHi,
  label,
  className = "",
  variant = "default",
  size = "sm",
  onShared,
}: ShareButtonProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={busy || (!imageUrls.length && !caption)}
      className={`gap-1.5 font-bold ${className}`}
      onClick={async () => {
        setBusy(true);
        try {
          onShared?.();
          await shareImagesWithCaption({ imageUrls, caption, fileBaseName, isHi });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {label ?? (isHi ? "शेयर करें" : "Share")}
    </Button>
  );
}
