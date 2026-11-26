import { describe, expect, it } from "vitest";
import { mapHeaders, parseDateCell, parseImportRows, TEMPLATE_EXAMPLE, TEMPLATE_HEADERS } from "./import";

describe("mapHeaders", () => {
  it("understands French headers with accents and symbols", () => {
    const map = mapHeaders(TEMPLATE_HEADERS);
    expect(map).toMatchObject({
      plate: 0, brand_model: 1, category: 2, fuel: 3, gearbox: 4, daily_rate: 5, current_km: 6,
      first_registration_date: 7, insurance_expires_on: 8, technical_visit_expires_on: 9,
      oil_last_km: 10, oil_last_date: 11, oil_next_km: 12,
    });
  });
  it("understands English headers in any order", () => {
    const map = mapHeaders(["Model", "Daily rate", "Plate", "Fuel", "Gearbox", "Category", "Mileage", "Next oil change km"]);
    expect(map).toMatchObject({ brand_model: 0, daily_rate: 1, plate: 2, fuel: 3, gearbox: 4, category: 5, current_km: 6, oil_next_km: 7 });
  });
});

describe("parseDateCell", () => {
  it("reads dd/mm/yyyy, ISO and Excel serials", () => {
    expect(parseDateCell("31/12/2026")).toBe("2026-12-31");
    expect(parseDateCell("2026-12-31")).toBe("2026-12-31");
    expect(parseDateCell(46387)).toBe("2026-12-31");
    expect(parseDateCell("")).toBeNull();
    expect(parseDateCell("31/02/2026")).toBe("invalid");
  });
});

describe("parseImportRows", () => {
  it("validates rows and reports errors per line", () => {
    const { rows, missing } = parseImportRows([
      TEMPLATE_HEADERS,
      TEMPLATE_EXAMPLE,
      ["23456-B-6", "Renault Clio", "Compacte", "Essence", "Auto", "320", "12 500 km", "", "", "", "", "", ""],
      ["", "Sans matricule", "SUV", "Diesel", "Manuelle", 400, 0, "", "", "", "", "", ""],
      ["34567-A-1", "Mauvaise", "Camion", "Diesel", "Manuelle", 400, 0, "32/13/2020", "", "", "", "", ""],
      ["12345 A 6", "Doublon", "SUV", "Diesel", "Manuelle", 400, 0, "", "", "", "", "", ""],
      [null, null, null, null, null, null, null, null, null, null, null, null, null],
    ]);
    expect(missing).toEqual([]);
    expect(rows).toHaveLength(5);
    expect(rows[0].data).toMatchObject({ plate: "12345-A-6", category: "economy", fuel: "diesel", gearbox: "manuelle", daily_rate: 250, insurance_expires_on: "2026-12-31" });
    expect(rows[1].data).toMatchObject({ category: "compact", fuel: "essence", gearbox: "automatique", daily_rate: 320, current_km: 12500 });
    expect(rows[2].errors).toContain("plateRequired");
    expect(rows[3].errors).toEqual(expect.arrayContaining(["categoryUnknown", "dateInvalid:first_registration_date"]));
    expect(rows[4].errors).toEqual(["duplicateInFile"]);
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 6]);
  });
  it("reports required columns that are missing", () => {
    expect(parseImportRows([["Matricule", "Modèle"]]).missing).toEqual(["category", "fuel", "gearbox", "daily_rate"]);
  });
});
