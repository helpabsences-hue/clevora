"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "@/lib/auth/session";

export type AgencyContextValue = {
  id: string;
  name: string;
  role: Role;
  writable: boolean;
};

const AgencyContext = createContext<AgencyContextValue | null>(null);

export function AgencyProvider({ value, children }: { value: AgencyContextValue; children: ReactNode }) {
  return <AgencyContext value={value}>{children}</AgencyContext>;
}

export function useAgency(): AgencyContextValue {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error("useAgency must be used inside <AgencyProvider>");
  return ctx;
}

/**
 * Shows children only to the given roles. UI only — the server actions and
 * RLS policies enforce the same rules.
 */
export function Can({ role, children, fallback = null }: { role: Role | Role[]; children: ReactNode; fallback?: ReactNode }) {
  const { role: current } = useAgency();
  const allowed = Array.isArray(role) ? role.includes(current) : role === current;
  return <>{allowed ? children : fallback}</>;
}
