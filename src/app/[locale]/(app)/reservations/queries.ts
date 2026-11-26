import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export const RESERVATION_SELECT = `
  id, contract_number, status, start_at, end_at, actual_return_at, signed_at, cancelled_at, cancel_reason,
  delivery, delivery_place, return_place, delivery_fee, daily_price, advance_paid, franchise,
  deposit_taken, deposit_amount, km_out, km_in, fuel_out, fuel_in, equipment, documents_given, notes, extended_days,
  vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(id, plate, brand_model, current_km, daily_rate, category, fuel, gearbox),
  client:clients!reservations_agency_id_client_id_fkey(id, full_name, phone, id_type, id_number, address, nationality, birth_date, birth_place, id_expires_on, license_number, license_issued_on, license_issued_place),
  driver2:clients!reservations_agency_id_second_driver_id_fkey(id, full_name, phone, id_type, id_number, address, nationality, birth_date, birth_place, id_expires_on, license_number, license_issued_on, license_issued_place)
`;

export type ListedReservation = {
  id: string;
  contract_number: string;
  status: "reserved" | "on_rental" | "returned" | "cancelled";
  start_at: string;
  end_at: string;
  actual_return_at: string | null;
  signed_at: string | null;
  delivery: boolean;
  delivery_place: string | null;
  /** null: the car will be chosen on the contract */
  vehicle: { plate: string; brand_model: string } | null;
  client: { full_name: string; phone: string | null };
  balance: number;
};

/** Reservations for the list: active ones, plus the last 30 days of finished ones (or search results). */
export async function listReservations(supabase: ServerSupabase, agencyId: string, q: string): Promise<ListedReservation[]> {
  let ids: string[] | null = null;
  if (q.length >= 2) {
    const { data } = await supabase.rpc("search_reservation_ids", { p_agency: agencyId, p_q: q });
    ids = (data ?? []) as unknown as string[];
    if (!ids.length) return [];
  }
  let query = supabase
    .from("reservations")
    .select(
      "id, contract_number, status, start_at, end_at, actual_return_at, signed_at, delivery, delivery_place, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)",
    )
    .eq("agency_id", agencyId)
    .order("start_at", { ascending: true })
    .limit(500);
  if (ids) query = query.in("id", ids);
  else query = query.or(`status.in.(reserved,on_rental),end_at.gte.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`);
  const { data } = await query;
  const rows = data ?? [];
  const { data: totals } = rows.length
    ? await supabase.from("reservation_totals").select("id, balance").in("id", rows.map((r) => r.id))
    : { data: [] };
  const balance = new Map((totals ?? []).map((t) => [t.id, Number(t.balance)]));
  return rows.map((r) => ({
    ...(r as unknown as Omit<ListedReservation, "balance">),
    balance: balance.get(r.id) ?? 0,
  }));
}

export async function getReservation(supabase: ServerSupabase, agencyId: string, id: string) {
  const [{ data: reservation }, { data: totals }, { data: payments }] = await Promise.all([
    supabase.from("reservations").select(RESERVATION_SELECT).eq("agency_id", agencyId).eq("id", id).maybeSingle(),
    supabase.from("reservation_totals").select("planned_days, days, total, paid, balance").eq("id", id).maybeSingle(),
    supabase
      .from("reservation_payments")
      .select("id, amount, method, kind, paid_at, note")
      .eq("agency_id", agencyId)
      .eq("reservation_id", id)
      .order("paid_at"),
  ]);
  if (!reservation) return null;
  return { reservation, totals, payments: payments ?? [] };
}

/** Agency settings the wizard needs. */
export async function getBookingSettings(supabase: ServerSupabase, agencyId: string) {
  const { data } = await supabase
    .from("agencies")
    .select("min_driver_age, min_license_years, default_franchise, default_deposit, equipment_items, document_items")
    .eq("id", agencyId)
    .single();
  return {
    minDriverAge: data?.min_driver_age ?? 21,
    minLicenseYears: data?.min_license_years ?? 2,
    defaultFranchise: Number(data?.default_franchise ?? 0),
    defaultDeposit: Number(data?.default_deposit ?? 0),
    equipmentItems: data?.equipment_items ?? [],
    documentItems: data?.document_items ?? [],
  };
}
export type BookingSettings = Awaited<ReturnType<typeof getBookingSettings>>;
