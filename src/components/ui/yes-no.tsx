"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Every yes/no question: two big buttons, never a small checkbox. */
export function YesNo({
  value,
  onChange,
  label,
  id,
  disabled,
}: {
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const option = (v: boolean) => {
    const selected = value === v;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={() => onChange(v)}
        className={cn(
          "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-semibold transition-colors disabled:opacity-50",
          selected
            ? v
              ? "border-success bg-success-soft text-success"
              : "border-foreground/60 bg-muted text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-accent",
        )}
      >
        {v ? <CheckIcon className="size-5" aria-hidden /> : <XIcon className="size-5" aria-hidden />}
        {v ? t("yes") : t("no")}
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label={label} id={id} className="flex gap-2">
      {option(true)}
      {option(false)}
    </div>
  );
}

/** A yes/no question on one row (label + buttons), for checklists. */
export function YesNoRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-medium">{label}</span>
      <div className="sm:w-64">
        <YesNo label={label} value={value} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}
