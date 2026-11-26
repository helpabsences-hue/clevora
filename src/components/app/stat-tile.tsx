import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  info: "bg-info-soft text-info",
} as const;

/** A number with a label (and an optional link to where it comes from). */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  href,
  testId,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  hint?: ReactNode;
  href?: string;
  testId?: string;
}) {
  const body = (
    <Card className={cn("h-full shadow-xs", href && "transition-all hover:shadow-md motion-safe:hover:-translate-y-0.5")}>
      <CardContent className="flex flex-col gap-1 pt-4 sm:pt-5">
        {Icon ? (
          <span className={cn("mb-1 inline-flex size-9 items-center justify-center rounded-lg", TONES[tone])} aria-hidden>
            <Icon className="size-5" />
          </span>
        ) : null}
        <span className="min-w-0 break-words text-2xl font-bold tabular-nums sm:text-3xl [&_bdi]:whitespace-normal" data-testid={testId}>
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}
