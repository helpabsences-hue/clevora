import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral";

const DOT: Record<StatusTone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/60",
};
const TEXT: Record<StatusTone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
};

/**
 * Compact status for tables: a coloured dot and a short word, with the detail
 * ("jusqu'au 11/11") in small grey text underneath. Colour is never the only
 * signal: the word is always there.
 */
export function StatusPill({ tone, label, detail, className, testId }: { tone: StatusTone; label: ReactNode; detail?: ReactNode; className?: string; testId?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 flex-col leading-tight", className)} data-testid={testId}>
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap", TEXT[tone])}>
        <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
        {label}
      </span>
      {detail ? <span className="ps-3.5 text-xs text-muted-foreground">{detail}</span> : null}
    </span>
  );
}
