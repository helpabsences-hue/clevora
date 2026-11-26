import { cn } from "@/lib/utils";

export function NavBadge({ count, tone, className }: { count: number; tone: "danger" | "warning"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums text-white",
        tone === "danger" ? "bg-red-600" : "bg-amber-700",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
