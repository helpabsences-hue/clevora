import type { ListedReservation } from "../reservations/queries";
import type { ServerSupabase } from "@/lib/supabase/server";

export type ClientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  id_type: "cin" | "passport";
  id_number: string;
  license_number: string | null;
  nationality: string | null;
  anonymized_at: string | null;
  created_at: string;
  rentals: number;
  last_rental: string | null;
};

const LIMIT = 200;

/** Clients of the agency, most recent first; search by name, CIN / passport, phone or permis. */
export async function listClients(supabase: ServerSupabase, agencyId: string, q: string): Promise<{ rows: ClientRow[]; total: number; limited: boolean }> {
  let query = supabase
    .from("clients")
    .select("id, full_name, phone, id_type, id_number, license_number, nationality, anonymized_at, created_at", { count: "exact" })
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  const clean = q.replace(/[^\p{L}\p{N} -]/gu, " ").trim().slice(0, 60);
  if (clean.length >= 2) {
    const norm = clean.toUpperCase().replace(/[\s\-.]/g, "");
    const digits = clean.replace(/\D/g, "").replace(/^0/, "");
    const ors = [`full_name.ilike.%${clean}%`, `id_number_norm.ilike.%${norm}%`, `license_number.ilike.%${clean}%`];
    if (digits.length >= 4) ors.push(`phone.ilike.%${digits}%`);
    query = query.or(ors.join(","));
  }
  const { data, count } = await query;
  const clients = data ?? [];
  const ids = clients.map((c) => c.id);
  const stats = new Map<string, { rentals: number; last: string | null }>();
  if (ids.length) {
    const { data: res } = await supabase
      .from("reservations")
      .select("client_id, second_driver_id, start_at, status")
      .eq("agency_id", agencyId)
      .neq("status", "cancelled")
      .or(`client_id.in.(${ids.join(",")}),second_driver_id.in.(${ids.join(",")})`)
      .order("start_at", { ascending: false });
    for (const r of res ?? []) {
      for (const id of [r.client_id, r.second_driver_id]) {
        if (!id) continue;
        const s = stats.get(id) ?? { rentals: 0, last: null };
        s.rentals++;
        s.last ??= r.start_at;
        stats.set(id, s);
      }
    }
  }
  return {
    rows: clients.map((c) => ({ ...(c as Omit<ClientRow, "rentals" | "last_rental">), rentals: stats.get(c.id)?.rentals ?? 0, last_rental: stats.get(c.id)?.last ?? null })),
    total: count ?? clients.length,
    limited: (count ?? 0) > LIMIT,
  };
}

/** Every rental of a client (as main or second driver), newest first, with the balance. */
export async function listClientReservations(supabase: ServerSupabase, agencyId: string, clientId: string): Promise<ListedReservation[]> {
  const { data } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, status, start_at, end_at, actual_return_at, signed_at, delivery, delivery_place, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)",
    )
    .eq("agency_id", agencyId)
    .or(`client_id.eq.${clientId},second_driver_id.eq.${clientId}`)
    .order("start_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const { data: totals } = rows.length ? await supabase.from("reservation_totals").select("id, balance").in("id", rows.map((r) => r.id)) : { data: [] };
  const balance = new Map((totals ?? []).map((t) => [t.id, Number(t.balance)]));
  return rows.map((r) => ({ ...(r as unknown as Omit<ListedReservation, "balance">), balance: balance.get(r.id) ?? 0 }));
}
