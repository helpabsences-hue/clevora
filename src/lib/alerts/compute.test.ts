import { describe, expect, it } from "vitest";
import { buildDigest, dateStatus, digestSize, oilStatus, paperGroup } from "./compute";

const now = new Date("2026-11-09T10:00:00Z");

describe("badges", () => {
  it("dates: Expirée / Bientôt / OK", () => {
    expect(dateStatus("2026-11-08", "2026-11-09", 30)).toEqual({ state: "expired", daysLeft: -1 });
    expect(dateStatus("2026-12-09", "2026-11-09", 30)).toEqual({ state: "soon", daysLeft: 30 });
    expect(dateStatus("2026-12-10", "2026-11-09", 30)).toEqual({ state: "ok", daysLeft: 31 });
    expect(dateStatus(null, "2026-11-09", 30).state).toBe("unknown");
  });
  it("oil: À faire / Bientôt / OK", () => {
    expect(oilStatus(50000, 50000, 1500).state).toBe("due");
    expect(oilStatus(50000, 51500, 1500).state).toBe("soon");
    expect(oilStatus(50000, 51501, 1500).state).toBe("ok");
    expect(oilStatus(50000, null, 1500).state).toBe("unknown");
  });
  it("insurance groups", () => {
    expect([-3, 0, 7, 8, 31, 32, null].map(paperGroup)).toEqual(["expired", "week", "week", "month", "month", "later", "later"]);
  });
});

describe("buildDigest", () => {
  it("collects what needs attention, most urgent first", () => {
    const d = buildDigest(
      [
        { id: "1", plate: "A", brand_model: "Logan", current_km: 10000, oil_next_km: 10500, insurance_expires_on: "2026-11-20", technical_visit_expires_on: "2027-06-01" },
        { id: "2", plate: "B", brand_model: "Clio", current_km: 20000, oil_next_km: 19000, insurance_expires_on: "2026-11-01", technical_visit_expires_on: "2026-11-10" },
        { id: "3", plate: "C", brand_model: "Duster", current_km: 1000, oil_next_km: 9000, insurance_expires_on: "2027-11-01", technical_visit_expires_on: null },
      ],
      [{ contract_number: "C-1", end_at: "2026-11-08T10:00:00Z", client: "Karim", phone: null, car: "Logan · A" }, { contract_number: "C-2", end_at: "2026-11-12T10:00:00Z", client: "X", phone: null, car: "Clio · B" }],
      { alertDays: 30, alertKm: 1500 },
      now,
    );
    expect(d.insurance.map((x) => x.car)).toEqual(["Clio · B", "Logan · A"]);
    expect(d.visit.map((x) => x.car)).toEqual(["Clio · B"]);
    expect(d.oil.map((x) => [x.car, x.kmLeft])).toEqual([["Clio · B", -1000], ["Logan · A", 500]]);
    expect(d.lateReturns.map((x) => x.contract)).toEqual(["C-1"]);
    expect(digestSize(d)).toBe(6);
  });
});
