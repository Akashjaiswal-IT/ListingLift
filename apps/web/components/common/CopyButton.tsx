"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { copyToClipboard } from "~/lib/clipboard";

interface CopyButtonProps {
  text?: string | null;
  /** What is being copied, for the toast ("Title", "Caption"...). */
  label: string;
  isHi: boolean;
  onCopied?: () => void;
  className?: string;
  variant?: "ghost" | "outline" | "default" | "secondary";
  children?: React.ReactNode;
}

/** Copies text, confirms it really worked ("Copied"), and says so when it did not. */
export function CopyButton({ text, label, isHi, onCopied, className = "", variant = "ghost", children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopied?.();
      toast.success(isHi ? `${label} कॉपी हो गया!` : `${label} copied!`);
    } else {
      toast.error(isHi ? "कॉपी नहीं हो सका — टेक्स्ट को दबाकर चुनें" : "Couldn't copy — press and hold the text to select it");
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={!text}
      onClick={handleCopy}
      className={`h-9 gap-1 text-xs font-semibold ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      <span aria-live="polite">{copied ? (isHi ? "कॉपी हुआ" : "Copied") : children ?? (isHi ? "कॉपी करें" : "Copy")}</span>
    </Button>
  );
}
