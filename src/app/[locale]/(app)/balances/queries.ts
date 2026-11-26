import type { ServerSupabase } from "@/lib/supabase/server";

export type BalanceRow = {
  id: string;
  contract_number: string;
  status: "on_rental" | "returned";
  end_at: string;
  actual_return_at: string | null;
  client: { full_name: string; phone: string | null; id_number: string } | null;
  vehicle: { plate: string; brand_model: string } | null;
  total: number;
  paid: number;
  balance: number;
};

/**
 * Crédit clients: rentals that started (car out or returned) and are not fully paid.
 * Bookings not started yet are not debts. Biggest amount first.
 */
export async function getBalances(supabase: ServerSupabase, agencyId: string): Promise<BalanceRow[]> {
  const { data: totals } = await supabase.from("reservation_totals").select("id, total, paid, balance").eq("agency_id", agencyId).gt("balance", 0);
  const ids = (totals ?? []).map((x) => x.id);
  if (!ids.length) return [];
  const { data: res } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, status, end_at, actual_return_at, client:clients!reservations_agency_id_client_id_fkey(full_name, phone, id_number), vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model)",
    )
    .eq("agency_id", agencyId)
    .in("id", ids)
    .in("status", ["on_rental", "returned"]);
  const money = new Map((totals ?? []).map((x) => [x.id, x]));
  return (res ?? [])
    .map((r) => {
      const m = money.get(r.id)!;
      return { ...(r as unknown as Omit<BalanceRow, "total" | "paid" | "balance">), total: Number(m.total), paid: Number(m.paid), balance: Number(m.balance) };
    })
    .sort((a, b) => b.balance - a.balance);
}
