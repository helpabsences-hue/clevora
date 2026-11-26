/** Turns daily rows from SQL (stats_daily) into the bars of the chart. */
export type DailyRow = { day: string; revenue: number; charges: number; rented_days: number; damages?: number };
/** revenue = rent only; damages = damage fees kept at return; net = revenue + damages − charges. */
export type Bucket = { key: string; from: string; to: string; revenue: number; charges: number; damages: number; net: number; rentedDays: number; partial: boolean };

/** Up to 45 days → one bar per day; otherwise one bar per month. */
export function bucketGranularity(from: string, to: string): "day" | "month" {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  return days <= 45 ? "day" : "month";
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** `today` marks the month in progress as partial too (drawn lighter). */
export function toBuckets(rows: DailyRow[], from: string, to: string, today: string): Bucket[] {
  const granularity = bucketGranularity(from, to);
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const key = granularity === "day" ? r.day : r.day.slice(0, 7);
    let b = map.get(key);
    if (!b) {
      const bFrom = granularity === "day" ? r.day : `${key}-01`;
      const bTo = granularity === "day" ? r.day : lastDayOfMonth(key);
      const partial = granularity === "month" && (bFrom < from || bTo > to || (today >= bFrom && today < bTo));
      b = { key, from: bFrom, to: bTo, revenue: 0, charges: 0, damages: 0, net: 0, rentedDays: 0, partial };
      map.set(key, b);
    }
    b.revenue += Number(r.revenue);
    b.charges += Number(r.charges);
    b.damages += Number(r.damages ?? 0);
    b.rentedDays += Number(r.rented_days);
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ ...b, revenue: round(b.revenue), charges: round(b.charges), damages: round(b.damages), net: round(b.revenue + b.damages - b.charges) }));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Occupancy: rented car-days / (cars × days), as a whole percentage. */
export function occupancy(rentedDays: number, cars: number, days: number): number {
  if (cars <= 0 || days <= 0) return 0;
  return Math.round((rentedDays / (cars * days)) * 100);
}

/** Badge colour for an occupancy %: green ≥ 70, blue 45–69, orange < 45. */
export function occupancyTone(pct: number): "success" | "info" | "warning" {
  return pct >= 70 ? "success" : pct >= 45 ? "info" : "warning";
}

export const PERIODS = ["months", "days", "custom"] as const;
export type Period = (typeof PERIODS)[number];

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ?period=months (12 months) | days (30 days) | custom (&from&to, max 3 years) → dates. */
export function resolvePeriod(sp: Record<string, string | string[] | undefined>, today: string): { period: Period; from: string; to: string } {
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "months";
  const iso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (period === "days") return { period, from: addDays(today, -29), to: today };
  if (iso(sp.from) && iso(sp.to) && sp.from <= sp.to) {
    const min = addDays(sp.to, -366 * 3);
    return { period: "custom", from: sp.from < min ? min : sp.from, to: sp.to };
  }
  const [y, m] = today.split("-").map(Number);
  return { period: period === "custom" ? "custom" : "months", from: new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10), to: today };
}
