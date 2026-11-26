import { dayKey, daysBetween } from "@/lib/format";

/** Status of a date (insurance / technical visit) for the badges. */
export type DateStatus = { state: "expired" | "soon" | "ok" | "unknown"; daysLeft: number | null };

export function dateStatus(date: string | null, today: string, alertDays: number): DateStatus {
  if (!date) return { state: "unknown", daysLeft: null };
  const left = daysBetween(today, date);
  if (left < 0) return { state: "expired", daysLeft: left };
  if (left <= alertDays) return { state: "soon", daysLeft: left };
  return { state: "ok", daysLeft: left };
}

/** Status of the next oil change for the badges. */
export type OilStatus = { state: "due" | "soon" | "ok" | "unknown"; kmLeft: number | null };

export function oilStatus(currentKm: number, nextKm: number | null, alertKm: number): OilStatus {
  if (nextKm === null) return { state: "unknown", kmLeft: null };
  const left = nextKm - currentKm;
  if (left <= 0) return { state: "due", kmLeft: left };
  if (left <= alertKm) return { state: "soon", kmLeft: left };
  return { state: "ok", kmLeft: left };
}

/** Insurance page groups, by the nearest of the two dates. */
export type PaperGroup = "expired" | "week" | "month" | "later";

export function paperGroup(daysLeft: number | null): PaperGroup {
  if (daysLeft === null) return "later";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "week";
  if (daysLeft <= 31) return "month";
  return "later";
}

export type AlertCar = {
  id: string;
  plate: string;
  brand_model: string;
  current_km: number;
  oil_next_km: number | null;
  insurance_expires_on: string | null;
  technical_visit_expires_on: string | null;
};

export type AlertDigest = {
  insurance: Array<{ car: string; date: string; daysLeft: number }>;
  visit: Array<{ car: string; date: string; daysLeft: number }>;
  oil: Array<{ car: string; kmLeft: number }>;
  lateReturns: Array<{ contract: string; client: string; phone: string | null; car: string; endAt: string }>;
};

/** Everything that needs attention today for one agency (most urgent first in each list). */
export function buildDigest(
  cars: AlertCar[],
  late: Array<{ contract_number: string; end_at: string; client: string; phone: string | null; car: string }>,
  settings: { alertDays: number; alertKm: number },
  now: Date = new Date(),
): AlertDigest {
  const today = dayKey(now);
  const digest: AlertDigest = { insurance: [], visit: [], oil: [], lateReturns: [] };
  for (const c of cars) {
    const label = `${c.brand_model} · ${c.plate}`;
    const ins = dateStatus(c.insurance_expires_on, today, settings.alertDays);
    if (ins.state === "expired" || ins.state === "soon") digest.insurance.push({ car: label, date: c.insurance_expires_on!, daysLeft: ins.daysLeft! });
    const vis = dateStatus(c.technical_visit_expires_on, today, settings.alertDays);
    if (vis.state === "expired" || vis.state === "soon") digest.visit.push({ car: label, date: c.technical_visit_expires_on!, daysLeft: vis.daysLeft! });
    const oil = oilStatus(c.current_km, c.oil_next_km, settings.alertKm);
    if (oil.state === "due" || oil.state === "soon") digest.oil.push({ car: label, kmLeft: oil.kmLeft! });
  }
  digest.insurance.sort((a, b) => a.daysLeft - b.daysLeft);
  digest.visit.sort((a, b) => a.daysLeft - b.daysLeft);
  digest.oil.sort((a, b) => a.kmLeft - b.kmLeft);
  digest.lateReturns = late
    .filter((r) => new Date(r.end_at) < now)
    .sort((a, b) => a.end_at.localeCompare(b.end_at))
    .map((r) => ({ contract: r.contract_number, client: r.client, phone: r.phone, car: r.car, endAt: r.end_at }));
  return digest;
}

export function digestSize(d: AlertDigest): number {
  return d.insurance.length + d.visit.length + d.oil.length + d.lateReturns.length;
}
