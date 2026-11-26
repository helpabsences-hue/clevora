import "server-only";
import { resolveBrandColor } from "@/lib/brand";
import { logoUrl } from "@/lib/storage";
import type { ServerSupabase } from "@/lib/supabase/server";

export type ContractDriver = {
  full_name: string;
  phone: string | null;
  id_type: string;
  id_number: string;
  id_expires_on: string | null;
  address: string | null;
  nationality: string | null;
  birth_date: string | null;
  birth_place: string | null;
  license_number: string | null;
  license_issued_on: string | null;
  license_issued_place: string | null;
};

const DRIVER = "full_name, phone, id_type, id_number, id_expires_on, address, nationality, birth_date, birth_place, license_number, license_issued_on, license_issued_place";

/** Everything printed on a contract (reservation, drivers, car, totals, agency). */
export async function getContractData(supabase: ServerSupabase, agencyId: string, id: string) {
  const [{ data: r }, { data: totals }, { data: agency }] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        `id, contract_number, status, start_at, end_at, actual_return_at, signed_at, cancel_reason,
         delivery, delivery_place, return_place, delivery_fee, daily_price, franchise, deposit_taken, deposit_amount,
         km_out, km_in, fuel_out, fuel_in, equipment, documents_given, notes, extended_days, damage_fee, damage_note,
         vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(id, plate, brand_model, category, fuel, gearbox),
         driver1:clients!reservations_agency_id_client_id_fkey(${DRIVER}),
         driver2:clients!reservations_agency_id_second_driver_id_fkey(${DRIVER})`,
      )
      .eq("agency_id", agencyId)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("reservation_totals").select("planned_days, days, total, paid, balance").eq("id", id).maybeSingle(),
    supabase
      .from("agencies")
      .select("name, logo_path, brand_color, address, city, phone, email, rc, ice, if_number, patente, cnss, contract_terms")
      .eq("id", agencyId)
      .single(),
  ]);
  if (!r || !agency) return null;
  return {
    reservation: { ...r, driver1: r.driver1 as ContractDriver | null, driver2: r.driver2 as ContractDriver | null },
    totals: {
      days: totals?.days ?? 1,
      total: Number(totals?.total ?? 0),
      paid: Number(totals?.paid ?? 0),
      balance: Number(totals?.balance ?? 0),
    },
    agency: { ...agency, logoUrl: logoUrl(agency.logo_path), brand: resolveBrandColor(agency.brand_color).brand },
  };
}
export type ContractData = NonNullable<Awaited<ReturnType<typeof getContractData>>>;

/** What is still missing before the contract can be signed. */
export function missingInfo(data: ContractData): Array<{ key: string; step: number }> {
  const r = data.reservation;
  const missing: Array<{ key: string; step: number }> = [];
  const d1 = r.driver1;
  if (!r.vehicle) missing.push({ key: "car", step: 0 });
  if (!d1?.id_number) missing.push({ key: "driver1Id", step: 1 });
  if (!d1?.license_number) missing.push({ key: "driver1License", step: 1 });
  if (!d1?.phone) missing.push({ key: "driver1Phone", step: 1 });
  if (r.driver2 && !r.driver2.license_number) missing.push({ key: "driver2License", step: 1 });
  if (r.km_out === null) missing.push({ key: "kmOut", step: 3 });
  if (r.fuel_out === null) missing.push({ key: "fuelOut", step: 3 });
  return missing;
}
