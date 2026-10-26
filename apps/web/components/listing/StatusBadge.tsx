import { Badge } from "~/components/ui/badge";

const STATUS_LABELS: Record<string, { en: string; hi: string }> = {
  completed: { en: "Ready", hi: "तैयार" },
  failed: { en: "Failed", hi: "असफल" },
  queued: { en: "In queue", hi: "कतार में" },
  processing: { en: "Creating…", hi: "बन रहा है…" },
  uploaded: { en: "Not started", hi: "शुरू नहीं हुआ" },
};

export function listingStatusLabel(status: string, isHi: boolean): string {
  const label = STATUS_LABELS[status];
  return label ? (isHi ? label.hi : label.en) : status;
}

/** Localized listing status pill used on listing cards. */
export function StatusBadge({ status, isHi, className = "" }: { status: string; isHi: boolean; className?: string }) {
  const tone =
    status === "completed"
      ? "bg-success text-success-foreground border-transparent"
      : status === "failed"
        ? "bg-destructive text-white border-transparent"
        : "bg-secondary text-secondary-foreground";
  return (
    <Badge className={`text-xs font-bold ${tone} ${className}`}>{listingStatusLabel(status, isHi)}</Badge>
  );
}
