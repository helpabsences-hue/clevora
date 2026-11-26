import { describe, expect, it } from "vitest";
import { bucketGranularity, occupancy, occupancyTone, toBuckets } from "./stats";

const day = (d: string, revenue = 100, charges = 10, rented = 1) => ({ day: d, revenue, charges, rented_days: rented });

describe("statistics buckets", () => {
  it("one bar per day up to 45 days, per month beyond", () => {
    expect(bucketGranularity("2026-10-01", "2026-11-14")).toBe("day");
    expect(bucketGranularity("2026-10-01", "2026-11-15")).toBe("month");
  });
  it("sums per month and flags partial months", () => {
    const rows = [day("2026-09-30"), day("2026-10-01"), day("2026-10-31", 200, 0, 2), day("2026-11-05")];
    const b = toBuckets(rows, "2026-09-15", "2026-11-09", "2026-11-09");
    expect(b.map((x) => [x.key, x.revenue, x.charges, x.net, x.rentedDays, x.partial])).toEqual([
      ["2026-09", 100, 10, 90, 1, true], // range starts mid-September
      ["2026-10", 300, 10, 290, 3, false],
      ["2026-11", 100, 10, 90, 1, true], // month in progress
    ]);
  });
  it("occupancy and its badge", () => {
    expect(occupancy(21, 1, 30)).toBe(70);
    expect([70, 69, 45, 44].map(occupancyTone)).toEqual(["success", "info", "info", "warning"]);
    expect(occupancy(5, 0, 30)).toBe(0);
  });
});

describe("damage fees in the statistics", () => {
  it("are kept apart from rent and added to the profit", () => {
    // 3 months → one bar per month; both days fall in November
    const b = toBuckets(
      [
        { day: "2026-11-02", revenue: 300, charges: 100, rented_days: 1, damages: 0 },
        { day: "2026-11-03", revenue: 300, charges: 0, rented_days: 1, damages: 1500 },
      ],
      "2026-09-01",
      "2026-11-30",
      "2026-11-30",
    ).find((x) => x.key === "2026-11");
    expect(b).toMatchObject({ revenue: 600, damages: 1500, charges: 100, net: 2000 });
  });
});
