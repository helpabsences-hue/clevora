import { cn } from "@/lib/utils";

/** A thin bar 0–100 % (value can go over 100: the bar stays full). */
export function ProgressBar({ value, label, tone = "primary", className }: { value: number; label: string; tone?: "primary" | "success" | "warning"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}
