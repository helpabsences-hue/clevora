"use client";

import { CheckIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Big tappable chips for a single choice (role, reason, category…). */
export function ChoiceChips<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
  className,
}: {
  name: string;
  value: T | undefined;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode }>;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            name={name}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-14 min-w-0 items-start gap-3 rounded-xl border-2 bg-card p-3 text-start transition-colors hover:bg-accent",
              checked ? "border-primary bg-primary/5 dark:border-ring dark:bg-accent" : "border-border",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                checked ? "border-primary bg-primary text-primary-foreground dark:border-ring dark:bg-ring" : "border-input",
              )}
              aria-hidden
            >
              {checked ? <CheckIcon className="size-3.5" /> : null}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2 font-semibold [overflow-wrap:anywhere]">
                {o.icon}
                {o.label}
              </span>
              {o.description ? <span className="text-sm text-muted-foreground">{o.description}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
