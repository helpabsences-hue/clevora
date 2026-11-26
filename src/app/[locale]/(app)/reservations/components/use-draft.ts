"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ReservationInput } from "../schema";

/**
 * Brouillon de réservation: what was typed in the wizard is kept on this device
 * (localStorage) so a lost connection, a call or a closed tab loses nothing.
 * Only for NEW reservations, one draft per agency, forgotten after 3 days or
 * as soon as the reservation is saved.
 */
export type Draft = { values: ReservationInput; step: number; savedAt: number };

const MAX_AGE = 3 * 24 * 3600 * 1000;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** The stored draft, or null when there is none or it is older than 3 days. */
function read(key: string): string | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt } = JSON.parse(raw) as Draft;
    return Date.now() - savedAt < MAX_AGE ? raw : null;
  } catch {
    return null;
  }
}

export function useReservationDraft(agencyId: string, enabled: boolean) {
  const key = `parcolia:reservation-draft:${agencyId}`;
  // Read after hydration only (the server has no localStorage).
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (enabled ? read(key) : null),
    () => null,
  );
  let draft: Draft | null = null;
  if (raw) {
    try {
      draft = JSON.parse(raw) as Draft;
    } catch {
      draft = null;
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /** Save a little after each change (not on every key press). */
  const save = useCallback(
    (values: ReservationInput, step: number) => {
      if (!enabled) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify({ values, step, savedAt: Date.now() } satisfies Draft));
        } catch {
          // storage full or blocked: the draft is a convenience only
        }
      }, 600);
    },
    [enabled, key],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    notify();
  }, [key]);

  return { draft, save, clear };
}

/** Logout: forget every reservation draft kept on this device. */
export function clearReservationDrafts(): void {
  try {
    for (const k of Object.keys(window.localStorage)) if (k.startsWith("parcolia:reservation-draft:")) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
