/** Formatting rules from CLAUDE.md: "1 250 MAD", dd/mm/yyyy, Africa/Casablanca. */

export const TIME_ZONE = "Africa/Casablanca";

const moneyFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 1250 → "1 250 MAD" (normal spaces so it never breaks layouts or copy/paste). */
export function formatMoney(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${moneyFormatter.format(safe).replace(/[  ]/g, " ")} MAD`;
}

/** "1 250,50" / "1250.5" / "1 250" → 1250.5 (null when not a number). */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, "").replace(/MAD$/i, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date or ISO string → "dd/mm/yyyy" in Casablanca time. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return dateParts.format(d);
}

/** → "dd/mm/yyyy HH:mm" in Casablanca time. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return `${dateParts.format(d)} ${timeParts.format(d)}`;
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  return timeParts.format(typeof value === "string" ? new Date(value) : value);
}

/** Calendar day "yyyy-mm-dd" of a moment, in Casablanca time. */
export function dayKey(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const [dd, mm, yyyy] = dateParts.format(d).split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/** Whole days between two "yyyy-mm-dd" keys (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Matricule as typed → stored display form: uppercase, single spaces. */
export function normalizePlateInput(input: string): string {
  return input.toUpperCase().replace(/\s+/g, " ").trimStart();
}

/** Same rule as vehicles.plate_norm in the database (for search). */
export function plateNorm(input: string): string {
  return input.toUpperCase().replace(/[\s\-./|]/g, "");
}

/** Minutes to add to UTC to get Casablanca local time at that instant. */
function casablancaOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** "2026-11-12" + "10:30" typed in Casablanca → ISO instant in UTC. */
export function casablancaToIso(date: string, time: string): string {
  const naive = new Date(`${date}T${time || "00:00"}:00Z`);
  let utc = naive.getTime() - casablancaOffsetMinutes(naive) * 60_000;
  // second pass in case the offset changes between the two instants (Ramadan / DST)
  utc = naive.getTime() - casablancaOffsetMinutes(new Date(utc)) * 60_000;
  return new Date(utc).toISOString();
}

/** ISO instant → { date: "yyyy-mm-dd", time: "HH:mm" } in Casablanca. */
export function isoToCasablanca(iso: string): { date: string; time: string } {
  return { date: dayKey(iso), time: formatTime(iso) };
}
