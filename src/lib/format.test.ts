import { describe, expect, it } from "vitest";
import { dayKey, formatDate, formatDateTime, formatMoney, parseMoney, plateNorm } from "./format";

describe("money", () => {
  it("formats MAD like 1 250 MAD", () => {
    expect(formatMoney(1250)).toBe("1 250 MAD");
    expect(formatMoney("1250.5")).toBe("1 250,5 MAD");
    expect(formatMoney(0)).toBe("0 MAD");
    expect(formatMoney(null)).toBe("0 MAD");
  });
  it("parses what people type", () => {
    expect(parseMoney("1 250")).toBe(1250);
    expect(parseMoney("1250,50")).toBe(1250.5);
    expect(parseMoney("300 MAD")).toBe(300);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
  });
});

describe("dates in Africa/Casablanca", () => {
  // Morocco is UTC+0 or UTC+1 depending on the period (tz database decides),
  // so these checks hold for both offsets.
  it("formats dd/mm/yyyy and HH:mm", () => {
    expect(formatDate("2026-11-03")).toBe("03/11/2026");
    expect(formatDateTime("2026-11-03T12:30:00Z")).toMatch(/^03\/11\/2026 1[23]:30$/);
  });
  it("uses the Casablanca calendar day, never the UTC one", () => {
    expect(dayKey("2026-11-03T12:00:00Z")).toBe("2026-11-03");
    const late = new Date("2026-11-03T23:30:00Z");
    const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", hour: "2-digit", hourCycle: "h23" }).format(late));
    expect(dayKey(late)).toBe(localHour < 23 ? "2026-11-04" : "2026-11-03");
  });
});

describe("plateNorm", () => {
  it("matches the database normalisation", () => {
    expect(plateNorm("12345-a-6")).toBe("12345A6");
    expect(plateNorm(" 12345 A 6 ")).toBe("12345A6");
  });
});

import { casablancaToIso, isoToCasablanca } from "./format";

describe("Casablanca local time ↔ UTC", () => {
  it("round-trips whatever the offset", () => {
    for (const [d, t] of [["2026-11-12", "10:30"], ["2026-03-20", "00:15"], ["2026-07-01", "23:45"]]) {
      expect(isoToCasablanca(casablancaToIso(d, t))).toEqual({ date: d, time: t });
    }
  });
});
