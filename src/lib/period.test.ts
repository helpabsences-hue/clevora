import { describe, expect, it } from "vitest";
import { periodOf, shiftMonth } from "./period";

describe("period of a list (month / year / dates)", () => {
  it("defaults to this month", () => {
    expect(periodOf({}, "2026-11-25")).toEqual({ kind: "month", month: "2026-11", from: "2026-11-01", to: "2026-11-30" });
  });
  it("a February has 28 or 29 days", () => {
    expect(periodOf({ month: "2028-02" }, "2026-11-25").to).toBe("2028-02-29");
  });
  it("a whole year", () => {
    expect(periodOf({ year: "2025" }, "2026-11-25")).toEqual({ kind: "year", year: 2025, from: "2025-01-01", to: "2025-12-31" });
  });
  it("any dates, swapped if typed backwards; bad dates fall back to the month", () => {
    expect(periodOf({ from: "2026-03-31", to: "2026-01-15" }, "2026-11-25")).toEqual({ kind: "range", from: "2026-01-15", to: "2026-03-31" });
    expect(periodOf({ from: "2026-13-40", to: "2026-01-15" }, "2026-11-25").kind).toBe("month");
  });
  it("months move across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
