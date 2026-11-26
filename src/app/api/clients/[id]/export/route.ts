import { NextResponse, type NextRequest } from "next/server";
import { getActiveAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Right of access (loi 09-08): everything the agency holds about one client,
 * as a JSON file to hand over. Admins only; RLS keeps it inside the agency.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const agency = await getActiveAgency();
  if (!agency || agency.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("agency_id", agency.id).eq("id", id).maybeSingle();
  if (!client) return new NextResponse("Not found", { status: 404 });
  const { data: reservations } = await supabase
    .from("reservations")
    .select("contract_number, status, start_at, end_at, actual_return_at, daily_price, delivery_place, return_place, km_out, km_in, signed_at, notes, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model)")
    .eq("agency_id", agency.id)
    .or(`client_id.eq.${id},second_driver_id.eq.${id}`)
    .order("start_at");
  await supabase.from("activity_log").insert({ agency_id: agency.id, action: "client.exported", entity: "client", entity_id: id, details: {} });
  const body = JSON.stringify({ agence: agency.name, exporte_le: new Date().toISOString(), client: { ...client, agency_id: undefined }, locations: reservations ?? [] }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="client-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
