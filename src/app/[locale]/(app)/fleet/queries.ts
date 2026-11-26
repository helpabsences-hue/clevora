import "server-only";
import { computeVehicleStatus, type VehicleStatus } from "@/lib/fleet/status";
import { dayKey } from "@/lib/format";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type FleetVehicle = VehicleRow & { computed: VehicleStatus; openMaintenanceId: string | null };

/** All cars of the agency with their computed status. */
export async function listVehicles(supabase: ServerSupabase, agencyId: string, now = new Date()): Promise<FleetVehicle[]> {
  const today = dayKey(now);
  const tomorrow = new Date(now.getTime() + 2 * 86_400_000).toISOString();
  const [{ data: vehicles }, { data: maintenance }, { data: reservations }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("agency_id", agencyId).order("brand_model").order("plate"),
    supabase
      .from("maintenance_periods")
      .select("id, vehicle_id, reason, starts_on, expected_end_on, ended_on")
      .eq("agency_id", agencyId)
      .or(`ended_on.is.null,ended_on.gt.${today}`),
    supabase
      .from("reservations")
      .select("vehicle_id, status, start_at, end_at")
      .eq("agency_id", agencyId)
      .in("status", ["on_rental", "reserved"])
      .lt("start_at", tomorrow),
  ]);

  return (vehicles ?? []).map((v) => {
    const m = (maintenance ?? []).filter((p) => p.vehicle_id === v.id);
    const computed = computeVehicleStatus(
      {
        status: v.status as "active" | "sold",
        insurance_expires_on: v.insurance_expires_on,
        maintenance: m,
        reservations: (reservations ?? []).filter((r) => r.vehicle_id === v.id),
      },
      now,
    );
    const open = m.find((p) => p.ended_on === null && p.starts_on <= today);
    return { ...v, computed, openMaintenanceId: open?.id ?? null };
  });
}

export async function getVehicle(supabase: ServerSupabase, agencyId: string, id: string, isAdmin: boolean) {
  const now = new Date();
  const monthStart = `${dayKey(now).slice(0, 7)}-01`;
  const [{ data: vehicle }, { data: maintenance }, { data: upcoming }, charges, monthReservations] = await Promise.all([
    supabase.from("vehicles").select("*").eq("agency_id", agencyId).eq("id", id).maybeSingle(),
    supabase
      .from("maintenance_periods")
      .select("id, reason, starts_on, expected_end_on, ended_on, note")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", id)
      .order("starts_on", { ascending: false }),
    supabase
      .from("reservations")
      .select("id, contract_number, status, start_at, end_at, client:clients!reservations_agency_id_client_id_fkey(full_name, phone)")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", id)
      .in("status", ["reserved", "on_rental"])
      .order("start_at")
      .limit(20),
    isAdmin
      ? supabase
          .from("charges")
          .select("id, date, category, amount, note")
          .eq("agency_id", agencyId)
          .eq("vehicle_id", id)
          .order("date", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
    isAdmin
      ? supabase
          .from("reservations")
          .select("start_at, end_at, actual_return_at, status, daily_price, delivery_fee")
          .eq("agency_id", agencyId)
          .eq("vehicle_id", id)
          .neq("status", "cancelled")
          // rentals touching this month (revenue is split per day afterwards)
          .gte("end_at", new Date(Date.parse(`${monthStart}T00:00:00Z`) - 86_400_000).toISOString())
      : Promise.resolve({ data: null }),
  ]);
  if (!vehicle) return null;

  const today = dayKey(now);
  const computed = computeVehicleStatus(
    {
      status: vehicle.status as "active" | "sold",
      insurance_expires_on: vehicle.insurance_expires_on,
      maintenance: (maintenance ?? []).filter((m) => m.ended_on === null || m.ended_on > today),
      reservations: (upcoming ?? []).map((r) => ({ status: r.status, start_at: r.start_at, end_at: r.end_at })),
    },
    now,
  );
  return {
    vehicle,
    computed,
    maintenance: maintenance ?? [],
    openMaintenance: (maintenance ?? []).find((m) => m.ended_on === null && m.starts_on <= today) ?? null,
    upcoming: upcoming ?? [],
    charges: charges.data,
    monthReservations: monthReservations.data,
  };
}

/** Active cars vs the plan limit (null = unlimited). */
export async function getVehicleUsage(supabase: ServerSupabase, agencyId: string) {
  const [{ count }, { data: agency }] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).eq("status", "active"),
    supabase.from("agencies").select("plan:plans(max_vehicles, name)").eq("id", agencyId).maybeSingle(),
  ]);
  const max = agency?.plan?.max_vehicles ?? null;
  return { count: count ?? 0, max, planName: agency?.plan?.name ?? null, atLimit: max !== null && (count ?? 0) >= max };
}
