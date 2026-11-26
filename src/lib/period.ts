/** A period picked on a list: one month, a whole year, or any dates (yyyy-mm-dd). */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export type Period =
  | { kind: "month"; month: string; from: string; to: string }
  | { kind: "year"; year: number; from: string; to: string }
  | { kind: "range"; from: string; to: string };

/** ?month=2026-11 (default: this month) · ?year=2026 · ?from=2026-01-15&to=2026-03-31 */
export function periodOf(sp: Record<string, string | string[] | undefined>, today: string): Period {
  if (isDay(sp.from) && isDay(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return { kind: "range", from, to };
  }
  if (typeof sp.year === "string" && /^\d{4}$/.test(sp.year)) {
    const year = Number(sp.year);
    return { kind: "year", year, from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  return { kind: "month", month, from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}
