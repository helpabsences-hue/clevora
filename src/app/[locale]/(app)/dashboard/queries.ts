import "server-only";
import { dayKey, daysBetween } from "@/lib/format";
import { maintenanceCovers } from "@/lib/fleet/status";
import { monthBounds, revenueBetween } from "@/lib/revenue";
import type { ServerSupabase } from "@/lib/supabase/server";
import { listVehicles } from "../fleet/queries";

export type DashboardReservation = {
  id: string;
  contract_number: string;
  status: string;
  start_at: string;
  end_at: string;
  signed_at: string | null;
  delivery: boolean;
  delivery_place: string | null;
  return_place: string | null;
  /** null: the car will be chosen on the contract */
  vehicle: { plate: string; brand_model: string } | null;
  client: { full_name: string; phone: string | null };
};

export type DashboardAlert =
  | { kind: "insurance" | "visit"; vehicleId: string; label: string; date: string; daysLeft: number }
  | { kind: "oil"; vehicleId: string; label: string; kmLeft: number }
  | { kind: "toSign"; count: number }
  | { kind: "maintenanceLate"; vehicleId: string; label: string; date: string };

export async function getDashboard(supabase: ServerSupabase, agencyId: string, isAdmin: boolean, now = new Date()) {
  const today = dayKey(now);
  const inAWeek = new Date(now.getTime() + 8 * 86_400_000).toISOString();
  const select =
    "id, contract_number, status, start_at, end_at, signed_at, delivery, delivery_place, return_place, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)";

  const [vehicles, { data: agency }, { data: onRental }, { data: departures }, { data: maintenance }, revenueRows] = await Promise.all([
    listVehicles(supabase, agencyId, now),
    supabase.from("agencies").select("alert_days_before, alert_km_before").eq("id", agencyId).single(),
    supabase.from("reservations").select(select).eq("agency_id", agencyId).eq("status", "on_rental").order("end_at"),
    supabase.from("reservations").select(select).eq("agency_id", agencyId).eq("status", "reserved").lt("start_at", inAWeek).order("start_at"),
    supabase.from("maintenance_periods").select("vehicle_id, starts_on, expected_end_on, ended_on").eq("agency_id", agencyId).is("ended_on", null),
    isAdmin
      ? (async () => {
          const m = monthBounds(now);
          const { data } = await supabase
            .from("reservations")
            .select("start_at, end_at, actual_return_at, status, daily_price, delivery_fee")
            .eq("agency_id", agencyId)
            .neq("status", "cancelled")
            .gte("end_at", new Date(Date.parse(`${m.from}T00:00:00Z`) - 86_400_000).toISOString())
            .lte("start_at", `${m.to}T23:59:59Z`);
          return revenueBetween((data ?? []).map((r) => ({ ...r, daily_price: Number(r.daily_price), delivery_fee: Number(r.delivery_fee) })), m.from, m.to);
        })()
      : Promise.resolve(null),
  ]);

  const active = vehicles.filter((v) => v.status === "active");
  const returns = (onRental ?? []) as unknown as DashboardReservation[];
  const leaving = (departures ?? []) as unknown as DashboardReservation[];
  const alertDays = agency?.alert_days_before ?? 30;
  const alertKm = agency?.alert_km_before ?? 1500;

  const alerts: DashboardAlert[] = [];
  for (const v of active) {
    const label = `${v.brand_model} · ${v.plate}`;
    for (const [kind, date] of [["insurance", v.insurance_expires_on], ["visit", v.technical_visit_expires_on]] as const) {
      if (!date) continue;
      const left = daysBetween(today, date);
      if (left <= alertDays) alerts.push({ kind, vehicleId: v.id, label, date, daysLeft: left });
    }
    if (v.oil_next_km !== null && v.oil_next_km - v.current_km <= alertKm) {
      alerts.push({ kind: "oil", vehicleId: v.id, label, kmLeft: v.oil_next_km - v.current_km });
    }
  }
  for (const m of maintenance ?? []) {
    if (m.expected_end_on && m.expected_end_on < today && maintenanceCovers(m, today)) {
      const v = active.find((x) => x.id === m.vehicle_id);
      if (v) alerts.push({ kind: "maintenanceLate", vehicleId: v.id, label: `${v.brand_model} · ${v.plate}`, date: m.expected_end_on });
    }
  }
  const toSign = leaving.filter((r) => !r.signed_at && r.start_at < new Date(now.getTime() + 2 * 86_400_000).toISOString()).length;
  if (toSign) alerts.unshift({ kind: "toSign", count: toSign });
  // Most urgent first: expired / overdue before "soon"
  alerts.sort((a, b) => urgency(a) - urgency(b));

  return {
    stats: {
      total: active.length,
      available: active.filter((v) => v.computed.kind === "available" || v.computed.kind === "reserved_today").length,
      onRental: returns.length,
      departuresToday: leaving.filter((r) => dayKey(r.start_at) === today).length,
      returnsToday: returns.filter((r) => dayKey(r.end_at) <= today).length,
      maintenance: active.filter((v) => v.computed.kind === "maintenance").length,
      revenueMonth: revenueRows,
    },
    returns,
    departures: leaving,
    alerts,
  };
}

function urgency(a: DashboardAlert): number {
  switch (a.kind) {
    case "toSign":
      return 0;
    case "maintenanceLate":
      return 1;
    case "oil":
      return a.kmLeft <= 0 ? 1 : 3;
    default:
      return a.daysLeft < 0 ? 1 : 2 + a.daysLeft / 1000;
  }
}
