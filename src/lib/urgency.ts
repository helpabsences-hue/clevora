import { dayKey, daysBetween } from "./format";

/**
 * Urgency groups (CLAUDE.md): late, today, tomorrow, after tomorrow, then each
 * day — most urgent first. Days within the next week are named by weekday.
 */
export type UrgencyKey = "late" | "today" | "tomorrow" | "afterTomorrow" | `day:${string}`;

export type UrgencyGroup<T> = {
  key: UrgencyKey;
  /** For "day:" groups: the yyyy-mm-dd day and whether it is within 7 days. */
  day?: string;
  withinWeek?: boolean;
  items: T[];
};

export function urgencyKeyFor(when: Date | string, now: Date, options: { lateIfPast?: boolean } = {}): UrgencyKey {
  const moment = typeof when === "string" ? new Date(when) : when;
  if (options.lateIfPast !== false && moment.getTime() < now.getTime()) {
    // Earlier today but already passed = late (a return at 09:00 not done at 11:00)
    return "late";
  }
  const diff = daysBetween(dayKey(now), dayKey(moment));
  if (diff <= 0) return diff < 0 ? "late" : "today";
  if (diff === 1) return "tomorrow";
  if (diff === 2) return "afterTomorrow";
  return `day:${dayKey(moment)}`;
}

const FIXED_ORDER: Record<string, number> = { late: 0, today: 1, tomorrow: 2, afterTomorrow: 3 };

/** Groups items by urgency, most urgent first; items keep their date order inside a group. */
export function groupByUrgency<T>(
  items: T[],
  getDate: (item: T) => Date | string,
  now: Date = new Date(),
  options: { lateIfPast?: boolean } = {},
): UrgencyGroup<T>[] {
  const sorted = [...items].sort((a, b) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime());
  const groups = new Map<UrgencyKey, UrgencyGroup<T>>();
  for (const item of sorted) {
    const key = urgencyKeyFor(getDate(item), now, options);
    if (!groups.has(key)) {
      const day = key.startsWith("day:") ? key.slice(4) : undefined;
      groups.set(key, {
        key,
        day,
        withinWeek: day ? daysBetween(dayKey(now), day) < 7 : undefined,
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()].sort((a, b) => {
    const oa = FIXED_ORDER[a.key] ?? 10;
    const ob = FIXED_ORDER[b.key] ?? 10;
    if (oa !== ob) return oa - ob;
    return (a.day ?? "").localeCompare(b.day ?? "");
  });
}
