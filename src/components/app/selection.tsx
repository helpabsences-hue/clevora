"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Selection = {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

/** Shared state for "tick several rows, then act on all of them". */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback(
    (id: string) =>
      setSelected((s) => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const setMany = useCallback(
    (ids: string[], on: boolean) =>
      setSelected((s) => {
        const next = new Set(s);
        for (const id of ids) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setSelected(new Set()), []);
  const value = useMemo(
    () => ({ selected, toggle, setMany, clear }),
    [selected, toggle, setMany, clear],
  );
  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): Selection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection outside SelectionProvider");
  return ctx;
}

/** A box with a 44px touch area, used in each row / card. */
function Box({
  checked,
  indeterminate = false,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  testId?: string;
}) {
  return (
    <label
      className="relative z-10 -m-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-accent"
      title={label}
    >
      <input
        type="checkbox"
        className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-lg opacity-0"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        aria-label={label}
        data-testid={testId}
      />
      <span
        aria-hidden
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          checked || indeterminate
            ? "border-primary bg-primary text-primary-foreground dark:border-ring dark:bg-ring dark:text-background"
            : "border-muted-foreground/50 bg-card",
        )}
      >
        {checked ? (
          <svg
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        ) : indeterminate ? (
          <span className="h-0.5 w-2.5 rounded bg-current" />
        ) : null}
      </span>
    </label>
  );
}

export function SelectBox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <Box
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      label={label}
      testId="select-row"
    />
  );
}

export function SelectAllBox({ ids, label }: { ids: string[]; label: string }) {
  const { selected, setMany } = useSelection();
  const count = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && count === ids.length;
  return (
    <Box
      checked={all}
      indeterminate={count > 0 && !all}
      onChange={() => setMany(ids, !all)}
      label={label}
      testId="select-all"
    />
  );
}

/** Sticky bar shown while rows are ticked (above the phone bottom navigation). */
export function SelectionBar({
  children,
  countLabel,
  clearLabel,
}: {
  children: ReactNode;
  countLabel: (n: number) => string;
  clearLabel: string;
}) {
  const { selected, clear } = useSelection();
  if (selected.size === 0) return null;
  return (
    <div
      role="region"
      aria-label={countLabel(selected.size)}
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border bg-card p-2 shadow-lg sm:flex-row sm:items-center md:bottom-4 md:start-[calc(4rem+0.75rem)] xl:start-[calc(16rem+0.75rem)]"
      data-testid="selection-bar"
    >
      <div className="flex min-w-0 items-center justify-between gap-2 ps-2">
        <span className="text-sm font-semibold whitespace-nowrap" aria-live="polite">
          {countLabel(selected.size)}
        </span>
        <button type="button" onClick={clear} className="min-h-11 rounded-lg px-2 text-sm whitespace-nowrap text-muted-foreground underline-offset-4 hover:underline">
          {clearLabel}
        </button>
      </div>
      <div className="grid auto-cols-fr grid-flow-col gap-2 sm:ms-auto sm:flex">{children}</div>
    </div>
  );
}
