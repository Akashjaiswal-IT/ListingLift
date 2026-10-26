"use client";

import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useLanguage } from "~/providers/LanguageContext";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Shown when a query fails, so a network error never looks like an empty account. */
export function ErrorState({ title, description, onRetry, className = "" }: ErrorStateProps) {
  const { language } = useLanguage();
  const isHi = language === "hi";

  return (
    <div
      role="alert"
      className={`rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3 ${className}`}
    >
      <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
      <div>
        <p className="font-bold text-foreground">
          {title ?? (isHi ? "डेटा लोड नहीं हो सका" : "Couldn't load this")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {description ??
            (isHi
              ? "इंटरनेट कनेक्शन जांचें और फिर से कोशिश करें।"
              : "Check your internet connection and try again.")}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {isHi ? "फिर से कोशिश करें" : "Try again"}
        </Button>
      )}
    </div>
  );
}
