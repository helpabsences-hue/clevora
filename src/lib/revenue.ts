import { dayKey, daysBetween } from "@/lib/format";

/**
 * Number of rental days of a reservation: each started 24 h counts as one day
 * (minimum 1). 10:00 → next day 10:00 = 1 day; 10:00 → next day 12:00 = 2 days.
 */
export function rentalDays(startAt: string | Date, endAt: string | Date): number {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000 - 1e-9));
}

export type RevenueReservation = {
  start_at: string;
  end_at: string;
  actual_return_at?: string | null;
  status: string;
  daily_price: number;
  delivery_fee: number;
};

/**
 * Revenue of reservations between two Casablanca days (both included).
 * Each rental day is attributed to the calendar day it starts on, so a
 * rental across two months is split between them. Delivery fee goes to the
 * first day. Returned rentals use the real return date.
 */
export function revenueBetween(reservations: RevenueReservation[], fromDay: string, toDay: string): number {
  let total = 0;
  for (const r of reservations) {
    if (r.status === "cancelled") continue;
    const end = r.status === "returned" && r.actual_return_at ? r.actual_return_at : r.end_at;
    const days = rentalDays(r.start_at, end);
    const firstDay = dayKey(r.start_at);
    for (let i = 0; i < days; i++) {
      const d = new Date(`${firstDay}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (key >= fromDay && key <= toDay) total += Number(r.daily_price);
    }
    if (firstDay >= fromDay && firstDay <= toDay) total += Number(r.delivery_fee);
  }
  return Math.round(total * 100) / 100;
}

/** First and last day ("yyyy-mm-dd") of the month containing `now`, in Casablanca. */
export function monthBounds(now: Date = new Date()): { from: string; to: string } {
  const today = dayKey(now);
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

export { daysBetween };
