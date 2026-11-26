import { describe, expect, it } from "vitest";
import { monthBounds, rentalDays, revenueBetween } from "./revenue";

describe("rentalDays", () => {
  it("counts each started 24 h", () => {
    expect(rentalDays("2026-11-01T10:00:00Z", "2026-11-02T10:00:00Z")).toBe(1);
    expect(rentalDays("2026-11-01T10:00:00Z", "2026-11-02T12:00:00Z")).toBe(2);
    expect(rentalDays("2026-11-01T10:00:00Z", "2026-11-01T12:00:00Z")).toBe(1);
  });
});

describe("revenueBetween", () => {
  const r = { daily_price: 300, delivery_fee: 150, status: "returned" };
  it("splits a rental across months", () => {
    const res = [{ ...r, start_at: "2026-10-30T10:00:00Z", end_at: "2026-11-03T10:00:00Z" }]; // 4 days: 30, 31, 1, 2
    expect(revenueBetween(res, "2026-10-01", "2026-10-31")).toBe(600 + 150);
    expect(revenueBetween(res, "2026-11-01", "2026-11-30")).toBe(600);
  });
  it("uses the real return date and ignores cancelled", () => {
    const res = [
      { ...r, start_at: "2026-11-01T10:00:00Z", end_at: "2026-11-05T10:00:00Z", actual_return_at: "2026-11-03T09:00:00Z" },
      { ...r, status: "cancelled", start_at: "2026-11-01T10:00:00Z", end_at: "2026-11-05T10:00:00Z" },
    ];
    expect(revenueBetween(res, "2026-11-01", "2026-11-30")).toBe(2 * 300 + 150);
  });
  it("month bounds", () => {
    expect(monthBounds(new Date("2026-02-10T12:00:00Z"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});
