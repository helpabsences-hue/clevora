import { notFound } from "next/navigation";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { ClientInput } from "../schema";

export async function getClient(supabase: ServerSupabase, agencyId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: c } = await supabase
    .from("clients")
    .select("id, id_type, id_number, full_name, phone, email, nationality, address, birth_date, birth_place, id_expires_on, license_number, license_issued_on, license_issued_place, notes, anonymized_at, created_at")
    .eq("agency_id", agencyId)
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const form: ClientInput = {
    id_type: c.id_type as "cin" | "passport",
    id_number: c.id_number,
    full_name: c.full_name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    nationality: c.nationality ?? "",
    address: c.address ?? "",
    birth_date: c.birth_date ?? "",
    birth_place: c.birth_place ?? "",
    id_expires_on: c.id_expires_on ?? "",
    license_number: c.license_number ?? "",
    license_issued_on: c.license_issued_on ?? "",
    license_issued_place: c.license_issued_place ?? "",
    notes: c.notes ?? "",
  };
  return { client: c, form };
}
