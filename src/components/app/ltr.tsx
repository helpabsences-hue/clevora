import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Keeps numbers, amounts, dates, phones, plates and emails in left-to-right
 * order inside Arabic (RTL) text: "1 250 MAD" never becomes "MAD 250 1".
 */
export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("whitespace-nowrap tabular-nums", className)}>
      {children}
    </bdi>
  );
}

/** "→" between two dates; points the reading direction in Arabic too. */
export function Arrow() {
  return (
    <span aria-hidden className="mx-1 inline-block rtl:-scale-x-100">
      →
    </span>
  );
}
