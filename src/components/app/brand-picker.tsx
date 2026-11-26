"use client";

import { UserIcon } from "lucide-react";
import type * as React from "react";
import { AgencyLogo } from "@/components/app/agency-logo";
import { BRAND_PRESETS, resolveBrandColor } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Brand colour picker + live header preview (signup and Settings). */
export function brandVars(color: string): React.CSSProperties {
  const brand = resolveBrandColor(color);
  return { ["--brand" as string]: brand.brand, ["--brand-foreground" as string]: brand.foreground };
}

export function ColorPicker({
  value,
  onChange,
  label,
  customLabel,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  customLabel: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {BRAND_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            aria-pressed={value.toUpperCase() === c}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full border-2 border-transparent",
              value.toUpperCase() === c && "border-foreground",
            )}
          >
            <span className="size-8 rounded-full ring-1 ring-black/10 dark:ring-white/25" style={{ backgroundColor: c }} />
          </button>
        ))}
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium hover:bg-accent">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          {customLabel}
        </label>
      </div>
    </fieldset>
  );
}

/** Live preview of the app header with the chosen logo and colour. */
export function HeaderPreview({
  agencyName,
  userName,
  logoUrl,
  color,
  labels,
}: {
  agencyName: string;
  userName: string;
  logoUrl: string | null;
  color: string;
  labels: { preview: string; role: string; button: string; fallback: string };
}) {
  const brand = resolveBrandColor(color);
  const name = agencyName.trim() || "—";
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{labels.preview}</span>
      <div className="overflow-hidden rounded-xl border bg-background" style={brandVars(color)} aria-hidden>
        <div className="flex items-center justify-between gap-3 border-b bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <AgencyLogo name={name} url={logoUrl} size={36} />
            <span className="truncate font-semibold">{name}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-end">
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{userName.trim() || "—"}</span>
              <span className="text-xs text-muted-foreground">{labels.role}</span>
            </span>
            <span className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-muted sm:inline-flex">
              <UserIcon className="size-4" />
            </span>
          </div>
        </div>
        <div className="p-3">
          <span className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground">
            {labels.button}
          </span>
        </div>
      </div>
      {brand.usedFallback ? <p className="text-sm text-warning">{labels.fallback}</p> : null}
    </div>
  );
}
