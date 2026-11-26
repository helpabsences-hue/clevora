"use client";

import { CalendarIcon, ClockIcon } from "lucide-react";
import { useState } from "react";
import type * as React from "react";
import { Input } from "@/components/ui/input";
import { formatMoney, normalizePlateInput, parseMoney } from "@/lib/format";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Base = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">;

/**
 * The browser's own calendar / clock button is made invisible and stretched
 * over our icon, so there is one icon and tapping it opens the picker.
 */
const PICKER =
  "relative pe-11 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:end-0 [&::-webkit-calendar-picker-indicator]:h-auto [&::-webkit-calendar-picker-indicator]:w-11 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

/**
 * Date (yyyy-mm-dd value), always SHOWN as dd/mm/yyyy: browsers draw the date box
 * in the phone's language (mm/dd/yyyy on an English phone), so our text sits on top
 * of it. Tapping still opens the phone's own calendar; while typing on a computer,
 * the browser's box shows.
 */
export function DateField({ value, onChange, className, onFocus, onBlur, ...props }: Base & { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const shown = /^\d{4}-\d{2}-\d{2}$/.test(value) && !focused ? value.split("-").reverse().join("/") : null;
  return (
    <div className="relative">
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(PICKER, shown && "text-transparent [&::-webkit-datetime-edit]:text-transparent", className)}
        {...props}
      />
      {shown ? (
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-base md:text-sm" dir="ltr" aria-hidden data-testid="date-shown">
          {shown}
        </span>
      ) : null}
      <CalendarIcon className="pointer-events-none absolute end-3 top-3 size-5 text-muted-foreground" aria-hidden />
    </div>
  );
}

/** The same date box inside a plain (GET) form: keeps its own value and submits it under `name`. */
export function DateInput({ name, defaultValue, ...props }: Base & { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return <DateField name={name} value={value} onChange={setValue} {...props} />;
}

/** Time (HH:mm value), always SHOWN as 24 h (an English phone would draw "09:00 PM"). */
export function TimeField({ value, onChange, className, onFocus, onBlur, ...props }: Base & { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const shown = /^\d{2}:\d{2}/.test(value) && !focused ? value.slice(0, 5) : null;
  return (
    <div className="relative">
      <Input
        type="time"
        step={300}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(PICKER, shown && "text-transparent [&::-webkit-datetime-edit]:text-transparent", className)}
        {...props}
      />
      {shown ? (
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-base md:text-sm" dir="ltr" aria-hidden>
          {shown}
        </span>
      ) : null}
      <ClockIcon className="pointer-events-none absolute end-3 top-3 size-5 text-muted-foreground" aria-hidden />
    </div>
  );
}

/** Amount in MAD. Accepts "1 250", "1250,50"… and shows "1 250" when not editing. */
export function MoneyField({
  value,
  onChange,
  className,
  ...props
}: Base & { value: number | null; onChange: (v: number | null) => void }) {
  const formatted = value === null ? "" : formatMoney(value).replace(/ MAD$/, "");
  // While typing we keep the raw text; otherwise we show the formatted amount.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatted;
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        dir="ltr"
        value={text}
        onFocus={() => setDraft(formatted)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseMoney(e.target.value));
        }}
        className={cn("pe-14 text-end tabular-nums", className)}
        {...props}
      />
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">MAD</span>
    </div>
  );
}

/** Matricule: uppercase as you type. */
export function PlateField({ value, onChange, className, ...props }: Base & { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      dir="ltr"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(normalizePlateInput(e.target.value))}
      className={cn("font-semibold uppercase tracking-wide", className)}
      placeholder="12345-A-6"
      {...props}
    />
  );
}

/** Phone: free typing, formatted as +212 6 12 34 56 78 when leaving the field. */
export function PhoneField({ value, onChange, className, ...props }: Base & { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="tel"
      inputMode="tel"
      dir="ltr"
      autoComplete="tel"
      placeholder="06 12 34 56 78"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        const n = normalizePhone(value);
        if (n) onChange(formatPhone(n));
      }}
      className={className}
      {...props}
    />
  );
}
