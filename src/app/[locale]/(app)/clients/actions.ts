"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";
import { clientSchema, type ClientInput } from "./schema";

const nullIfEmpty = (v: string | undefined) => (v && v.length ? v : null);

/** Add or edit a client (staff and admins). The CIN / passport number is unique per agency. */
export async function saveClientAction(input: ClientInput, id?: string): Promise<ActionResult<{ id: string }>> {
  if (id && !z.uuid().safeParse(id).success) return fail("forbidden");
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const v = parsed.data;
  const row = {
    id_type: v.id_type,
    id_number: v.id_number,
    full_name: v.full_name,
    phone: nullIfEmpty(v.phone),
    email: nullIfEmpty(v.email),
    nationality: nullIfEmpty(v.nationality),
    address: nullIfEmpty(v.address),
    birth_date: nullIfEmpty(v.birth_date),
    birth_place: nullIfEmpty(v.birth_place),
    id_expires_on: nullIfEmpty(v.id_expires_on),
    license_number: nullIfEmpty(v.license_number),
    license_issued_on: nullIfEmpty(v.license_issued_on),
    license_issued_place: nullIfEmpty(v.license_issued_place),
    notes: nullIfEmpty(v.notes),
  };
  const res = id
    ? await supabase.from("clients").update(row).eq("id", id).eq("agency_id", agency.id).select("id").maybeSingle()
    : await supabase.from("clients").insert({ ...row, agency_id: agency.id }).select("id").single();
  if (res.error) {
    if (res.error.code === "23505") {
      // Same CIN / passport already saved: point to that client.
      const norm = v.id_number.toUpperCase().replace(/[\s\-.]/g, "");
      const { data: existing } = await supabase.from("clients").select("id").eq("agency_id", agency.id).eq("id_type", v.id_type).eq("id_number_norm", norm).maybeSingle();
      return fail("clientExists", { id_number: "clientExists", ...(existing ? { existing_id: existing.id } : {}) });
    }
    return fail(dbErrorKey(res.error));
  }
  if (!res.data) return fail("notFound");
  revalidatePath("/[locale]/clients", "layout");
  return ok({ id: res.data.id });
}

/** Delete a client with no rental (admins). Clients with rentals stay: they are in contracts. */
export async function deleteClientAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase.from("clients").delete().eq("id", id).eq("agency_id", guard.ctx.agency.id).select("id");
  if (error?.code === "23503") return fail("clientHasRentals");
  if (error) return fail(dbErrorKey(error));
  if (!data?.length) return fail("notFound");
  revalidatePath("/[locale]/clients", "layout");
  return ok();
}
