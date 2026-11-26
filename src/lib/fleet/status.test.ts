import { describe, expect, it } from "vitest";
import { computeVehicleStatus, maintenanceCovers, vehicleAgeYears } from "./status";

const now = new Date("2026-11-09T10:00:00Z");
const base = { status: "active" as const, insurance_expires_on: "2027-01-01", maintenance: [], reservations: [] };

describe("computeVehicleStatus — priority Maintenance > En location > Bloquée > Réservée > Disponible", () => {
  it("available by default", () => {
    expect(computeVehicleStatus(base, now)).toEqual({ kind: "available" });
  });
  it("reserved when a reservation leaves today", () => {
    const v = { ...base, reservations: [{ status: "reserved", start_at: "2026-11-09T15:00:00Z", end_at: "2026-11-12T15:00:00Z" }] };
    expect(computeVehicleStatus(v, now).kind).toBe("reserved_today");
  });
  it("blocked when insurance has expired, even if a reservation leaves today", () => {
    const v = {
      ...base,
      insurance_expires_on: "2026-11-01",
      reservations: [{ status: "reserved", start_at: "2026-11-09T15:00:00Z", end_at: "2026-11-12T15:00:00Z" }],
    };
    expect(computeVehicleStatus(v, now).kind).toBe("blocked");
  });
  it("on rental beats insurance", () => {
    const v = { ...base, insurance_expires_on: "2026-11-01", reservations: [{ status: "on_rental", start_at: "2026-11-05T10:00:00Z", end_at: "2026-11-10T10:00:00Z" }] };
    expect(computeVehicleStatus(v, now)).toEqual({ kind: "on_rental", until: "2026-11-10T10:00:00Z", untilDay: "10/11" });
  });
  it("maintenance beats everything and shows reason and date", () => {
    const v = {
      ...base,
      reservations: [{ status: "on_rental", start_at: "2026-11-05T10:00:00Z", end_at: "2026-11-10T10:00:00Z" }],
      maintenance: [{ reason: "panne", starts_on: "2026-11-08", expected_end_on: "2026-11-12", ended_on: null }],
    };
    expect(computeVehicleStatus(v, now)).toEqual({ kind: "maintenance", reason: "panne", until: "2026-11-12" });
  });
  it("future or finished maintenance does not block today", () => {
    const v = {
      ...base,
      maintenance: [
        { reason: "pneus", starts_on: "2026-11-20", expected_end_on: "2026-11-21", ended_on: null },
        { reason: "panne", starts_on: "2026-11-01", expected_end_on: "2026-11-05", ended_on: "2026-11-04" },
      ],
    };
    expect(computeVehicleStatus(v, now).kind).toBe("available");
  });
  it("sold cars are sold", () => {
    expect(computeVehicleStatus({ ...base, status: "sold" }, now).kind).toBe("sold");
  });
});

describe("maintenanceCovers", () => {
  it("back in service on ended_on day", () => {
    const m = { starts_on: "2026-11-01", expected_end_on: "2026-11-10", ended_on: "2026-11-05" };
    expect(maintenanceCovers(m, "2026-11-04")).toBe(true);
    expect(maintenanceCovers(m, "2026-11-05")).toBe(false);
  });
  it("still in the garage after the expected date until put back in service", () => {
    const m = { starts_on: "2026-11-01", expected_end_on: "2026-11-05", ended_on: null };
    expect(maintenanceCovers(m, "2026-11-09")).toBe(true);
  });
});

describe("vehicleAgeYears", () => {
  it("counts whole years", () => {
    expect(vehicleAgeYears("2021-11-10", now)).toBe(4);
    expect(vehicleAgeYears("2021-11-09", now)).toBe(5);
    expect(vehicleAgeYears(null, now)).toBeNull();
  });
});
