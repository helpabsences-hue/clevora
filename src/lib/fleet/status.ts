import { dayKey, formatDate, formatTime } from "@/lib/format";

/**
 * Computed status of a car (never stored), by priority:
 * Maintenance > En location > Bloquée (insurance expired) > Réservée (leaves today) > Disponible.
 */
export type VehicleStatus =
  | { kind: "maintenance"; reason: string; until: string | null }
  | { kind: "on_rental"; until: string; untilDay: string }
  | { kind: "blocked" }
  | { kind: "reserved_today"; at: string; time: string }
  | { kind: "available" }
  | { kind: "sold" };

export type StatusInput = {
  status: "active" | "sold";
  insurance_expires_on: string | null;
  maintenance: Array<{ reason: string; starts_on: string; expected_end_on: string | null; ended_on: string | null }>;
  reservations: Array<{ status: string; start_at: string; end_at: string }>;
};

/** Is the car in the garage on this Casablanca day? (same rule as maintenance_blocked_days in SQL) */
export function maintenanceCovers(
  m: { starts_on: string; expected_end_on: string | null; ended_on: string | null },
  day: string,
  { openMeansOngoing = true } = {},
): boolean {
  if (m.starts_on > day) return false;
  if (m.ended_on) return day < m.ended_on;
  if (openMeansOngoing) return true; // still in the garage (even past its expected date)
  return m.expected_end_on === null || day <= m.expected_end_on;
}

export function computeVehicleStatus(v: StatusInput, now: Date = new Date()): VehicleStatus {
  if (v.status === "sold") return { kind: "sold" };
  const today = dayKey(now);
  const m = v.maintenance.find((p) => maintenanceCovers(p, today));
  if (m) return { kind: "maintenance", reason: m.reason, until: m.expected_end_on };
  const rental = v.reservations.find((r) => r.status === "on_rental");
  if (rental) return { kind: "on_rental", until: rental.end_at, untilDay: formatDate(rental.end_at).slice(0, 5) };
  if (v.insurance_expires_on && v.insurance_expires_on < today) return { kind: "blocked" };
  const leaving = v.reservations.find((r) => r.status === "reserved" && dayKey(r.start_at) === today);
  if (leaving) return { kind: "reserved_today", at: leaving.start_at, time: formatTime(leaving.start_at) };
  return { kind: "available" };
}

/** Age in whole years from the first registration date. */
export function vehicleAgeYears(firstRegistration: string | null, now: Date = new Date()): number | null {
  if (!firstRegistration) return null;
  const [y, m, d] = firstRegistration.split("-").map(Number);
  const [ty, tm, td] = dayKey(now).split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return Math.max(0, age);
}

/** Rental cars older than this get a warning badge (agencies usually renew cars around 5 years). */
export const AGE_WARNING_YEARS = 5;
