import { describe, expect, it } from "vitest";
import { groupByUrgency, urgencyKeyFor } from "./urgency";

// Monday 9 November 2026, 11:00 in Casablanca (10:00 UTC)
const now = new Date("2026-11-09T10:00:00Z");

describe("urgencyKeyFor", () => {
  it("classifies by Casablanca day", () => {
    expect(urgencyKeyFor("2026-11-09T08:00:00Z", now)).toBe("late"); // earlier today, passed
    expect(urgencyKeyFor("2026-11-08T17:00:00Z", now)).toBe("late");
    expect(urgencyKeyFor("2026-11-09T16:00:00Z", now)).toBe("today");
    expect(urgencyKeyFor("2026-11-10T09:00:00Z", now)).toBe("tomorrow");
    expect(urgencyKeyFor("2026-11-11T09:00:00Z", now)).toBe("afterTomorrow");
    expect(urgencyKeyFor("2026-11-14T09:00:00Z", now)).toBe("day:2026-11-14");
  });
  it("can ignore 'late' for date-only lists", () => {
    expect(urgencyKeyFor("2026-11-09T08:00:00Z", now, { lateIfPast: false })).toBe("today");
  });
});

describe("groupByUrgency", () => {
  it("orders most urgent first with counts", () => {
    const items = [
      { id: "later", at: "2026-11-30T09:00:00Z" },
      { id: "tomorrow", at: "2026-11-10T09:00:00Z" },
      { id: "late", at: "2026-11-07T09:00:00Z" },
      { id: "today", at: "2026-11-09T15:00:00Z" },
      { id: "sat", at: "2026-11-14T09:00:00Z" },
      { id: "today2", at: "2026-11-09T12:00:00Z" },
    ];
    const groups = groupByUrgency(items, (i) => i.at, now);
    expect(groups.map((g) => g.key)).toEqual(["late", "today", "tomorrow", "day:2026-11-14", "day:2026-11-30"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["today2", "today"]);
    expect(groups[3].withinWeek).toBe(true);
    expect(groups[4].withinWeek).toBe(false);
  });
});
