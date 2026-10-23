"use client";

import { Sparkles, CheckCircle2, Loader2, XCircle, Circle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { getStepStates } from "~/lib/generation-steps";

export interface GenerationProgressInfo {
  generationStage?: string | null;
  errorMessage?: string | null;
  retryCount?: number | null;
  maxAttempts?: number | null;
  creditsRefunded?: boolean | null;
  creditsCharged?: number | null;
}

interface GenerationProgressCardProps {
  isHi: boolean;
  status: string;
  info?: GenerationProgressInfo;
  isRetrying?: boolean;
  onRetry: () => void;
  onEditDetails: () => void;
}

// First line only (no stack traces), shortened for the failure panel
function shortError(message: string): string {
  const line = message.split("\n")[0]!.trim();
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

/** Step 3 "Studio Photos & Cards" card: real stage progress and a failure state with retry. */
export function GenerationProgressCard({
  isHi,
  status,
  info,
  isRetrying = false,
  onRetry,
  onEditDetails,
}: GenerationProgressCardProps) {
  const stepStates = getStepStates(status, info?.generationStage);
  const refundedCredits = info?.creditsRefunded ? info.creditsCharged ?? 0 : 0;

  return (
    <Card className="border-border/60 bg-card p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm text-foreground">
            {isHi ? "स्टूडियो फ़ोटो और कार्ड्स" : "Studio Photos & Cards"}
          </span>
        </div>
        <Badge
          variant={status === "failed" ? "destructive" : "secondary"}
          className={`capitalize text-[10px] ${
            status === "completed"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : ""
          }`}
        >
          {isHi
            ? status === "completed" ? "पूर्ण" : status === "failed" ? "असफल" : "प्रगति पर"
            : status}
        </Badge>
      </div>

      {status === "queued" && !!info?.retryCount && info.retryCount > 0 && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          {isHi
            ? `फिर से कोशिश हो रही है (प्रयास ${info.retryCount + 1}/${info.maxAttempts})…`
            : `Retrying (attempt ${info.retryCount + 1} of ${info.maxAttempts})…`}
        </p>
      )}

      <div className="space-y-4 text-xs" aria-live="polite">
        {[
          isHi ? "सामान्य बैकग्राउंड क्लीनअप और संरेखण" : "Crop & Cleanse Raw Backdrop",
          isHi ? "विज़न प्रॉम्प्ट विश्लेषण" : "OpenAI Vision Prompt Enhancement",
          isHi ? "AI स्टूडियो रेंडरिंग" : "AI Studio Rendering",
          isHi ? "व्हाट्सएप व इंस्टाग्राम स्टोरी कार्ड कम्पोज़िंग" : "WhatsApp & Instagram Story Card Compositing",
        ].map((label, idx) => {
          const state = stepStates[idx]!;
          return (
            <div key={idx} className="flex items-center justify-between">
              <span className={state === "failed" ? "text-destructive font-medium" : "text-muted-foreground"}>
                {label}
              </span>
              {state === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
              {state === "active" && <Loader2 className="h-4 w-4 text-primary animate-spin" aria-hidden="true" />}
              {state === "failed" && <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />}
              {state === "pending" && <Circle className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />}
              <span className="sr-only">
                {state === "done"
                  ? isHi ? "पूर्ण" : "Done"
                  : state === "active"
                  ? isHi ? "प्रगति पर" : "In progress"
                  : state === "failed"
                  ? isHi ? "असफल" : "Failed"
                  : isHi ? "शुरू नहीं हुआ" : "Not started"}
              </span>
            </div>
          );
        })}
      </div>

      {status === "failed" && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3 text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-destructive">
              {isHi ? "स्टूडियो इमेज जनरेट नहीं हो सकीं।" : "Studio images couldn't be generated."}
            </p>
            {info?.errorMessage && (
              <p className="text-[11px] text-muted-foreground break-words">
                {shortError(info.errorMessage)}
              </p>
            )}
          </div>
          <p className="text-muted-foreground">
            {info?.creditsRefunded
              ? isHi
                ? `${info.creditsCharged} क्रेडिट्स आपके बैलेंस में वापस कर दिए गए हैं।`
                : `${info.creditsCharged} credits were refunded to your balance.`
              : isHi
              ? "हम आपका रिफंड प्रोसेस कर रहे हैं — अगर वह न दिखे तो सपोर्ट से संपर्क करें।"
              : "We're processing your refund — contact support if it doesn't appear."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onRetry} disabled={isRetrying}>
              {isRetrying
                ? isHi ? "फिर से शुरू हो रहा है…" : "Retrying…"
                : refundedCredits > 0
                ? isHi
                  ? `फिर से कोशिश करें (${refundedCredits} क्रेडिट्स)`
                  : `Try again (${refundedCredits} credits)`
                : isHi ? "फिर से कोशिश करें" : "Try again"}
            </Button>
            <Button size="sm" variant="outline" onClick={onEditDetails} disabled={isRetrying}>
              {isHi ? "विवरण बदलें" : "Edit details"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
