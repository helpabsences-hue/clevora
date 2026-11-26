"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";
import { ACTIVE_AGENCY_COOKIE } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";
import { LOGO_MAX_BYTES, LOGO_TYPES, type LogoType } from "@/lib/storage";
import { SETTINGS_SCHEMAS, type SettingsInput, type SettingsSection } from "./schema";

function refresh() {
  // Name, logo and colour are in the header of every page.
  revalidatePath("/", "layout");
}

async function log(ctx: { supabase: ServerSupabase; agencyId: string; userId: string }, section: string, fields: string[]) {
  await ctx.supabase.from("activity_log").insert({ agency_id: ctx.agencyId, actor_id: ctx.userId, action: "settings.update", entity: "agency", entity_id: ctx.agencyId, details: { section, fields } });
}

/** Save one section of the agency settings (admins only; RLS checks it again). */
export async function saveSettingsAction<S extends SettingsSection>(section: S, input: SettingsInput<S>): Promise<ActionResult> {
  const schema = SETTINGS_SCHEMAS[section];
  if (!schema) return fail("forbidden");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency, user } = guard.ctx;
  // Every section schema only holds columns of public.agencies.
  const values = parsed.data as TablesUpdate<"agencies">;
  const { error, count } = await supabase.from("agencies").update(values, { count: "exact" }).eq("id", agency.id);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("forbidden");
  await log({ supabase, agencyId: agency.id, userId: user.id }, section, Object.keys(values));
  refresh();
  return ok();
}

/** Upload a new logo ({agency_id}/logo-*.ext in the public agency-logos bucket). */
export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("invalidForm", { logo: "required" });
  if (!(file.type in LOGO_TYPES)) return fail("invalidForm", { logo: "logoType" });
  if (file.size > LOGO_MAX_BYTES) return fail("invalidForm", { logo: "logoSize" });
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency, user } = guard.ctx;
  const path = `${agency.id}/logo-${Date.now()}.${LOGO_TYPES[file.type as LogoType]}`;
  const { error: upError } = await supabase.storage.from("agency-logos").upload(path, file, { contentType: file.type, upsert: true });
  if (upError) return fail("unknown");
  const { error } = await supabase.from("agencies").update({ logo_path: path }).eq("id", agency.id);
  if (error) return fail(dbErrorKey(error));
  if (agency.logoPath && agency.logoPath !== path) await supabase.storage.from("agency-logos").remove([agency.logoPath]);
  await log({ supabase, agencyId: agency.id, userId: user.id }, "agency", ["logo_path"]);
  refresh();
  return ok();
}

export async function removeLogoAction(): Promise<ActionResult> {
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency, user } = guard.ctx;
  const { error } = await supabase.from("agencies").update({ logo_path: null }).eq("id", agency.id);
  if (error) return fail(dbErrorKey(error));
  if (agency.logoPath) await supabase.storage.from("agency-logos").remove([agency.logoPath]);
  await log({ supabase, agencyId: agency.id, userId: user.id }, "agency", ["logo_path"]);
  refresh();
  return ok();
}

/** Every file under a prefix, folders included (storage lists one level at a time). */
async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const admin = createAdminClient();
  const out: string[] = [];
  const queue = [prefix];
  while (queue.length) {
    const dir = queue.shift()!;
    for (let offset = 0; ; offset += 1000) {
      const { data } = await admin.storage.from(bucket).list(dir, { limit: 1000, offset });
      if (!data?.length) break;
      for (const item of data) {
        const full = `${dir}/${item.name}`;
        if (item.id) out.push(full);
        else queue.push(full);
      }
      if (data.length < 1000) break;
    }
  }
  return out;
}

/**
 * Delete the agency and everything in it (admins, typed name as confirmation).
 * Works in read-only mode too: owners can always leave with their right to erasure.
 */
export async function deleteAgencyAction(confirmName: string): Promise<ActionResult> {
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { error } = await supabase.rpc("delete_agency", { p_agency: agency.id, p_confirm_name: String(confirmName ?? "") });
  if (error) return error.hint === "confirm_name" ? fail("invalidForm", { confirm: "confirmName" }) : fail(dbErrorKey(error));
  // Database rows are gone; now the files (service role: the agency no longer exists for RLS).
  const admin = createAdminClient();
  for (const bucket of ["agency-logos", "agency-docs"]) {
    const files = await listAll(bucket, agency.id);
    for (let i = 0; i < files.length; i += 100) await admin.storage.from(bucket).remove(files.slice(i, i + 100));
  }
  (await cookies()).delete(ACTIVE_AGENCY_COOKIE);
  refresh();
  return ok();
}

// ---------------------------------------------------------------------------
// Vie privée (loi 09-08): find a client, export or anonymize, retention.
// ---------------------------------------------------------------------------
export type ClientHit = { id: string; full_name: string; id_number: string; phone: string | null; rentals: number; anonymized: boolean };

export async function searchClientsAction(q: string): Promise<ActionResult<ClientHit[]>> {
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const clean = String(q ?? "").replace(/[^\p{L}\p{N} -]/gu, " ").trim().slice(0, 60);
  if (clean.length < 2) return ok([]);
  const digits = clean.replace(/\D/g, "").replace(/^0/, "");
  const ors = [`full_name.ilike.%${clean}%`, `id_number.ilike.%${clean}%`];
  if (digits.length >= 4) ors.push(`phone.ilike.%${digits}%`);
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, id_number, phone, anonymized_at, reservations:reservations!reservations_agency_id_client_id_fkey(count)")
    .eq("agency_id", agency.id)
    .or(ors.join(","))
    .limit(10);
  if (error) return fail(dbErrorKey(error));
  return ok(
    (data ?? []).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      id_number: c.id_number,
      phone: c.phone,
      rentals: (c.reservations as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
      anonymized: Boolean(c.anonymized_at),
    })),
  );
}

export async function anonymizeClientAction(clientId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(clientId).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { error } = await supabase.rpc("anonymize_client", { p_agency: agency.id, p_client: clientId });
  if (error) return fail(error.hint === "client_active" ? "clientActive" : dbErrorKey(error));
  return ok();
}

export async function oldClientsCountAction(years: number): Promise<ActionResult<number>> {
  if (!Number.isInteger(years) || years < 1 || years > 20) return fail("invalidForm");
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { data, error } = await supabase.rpc("old_clients", { p_agency: agency.id, p_years: years });
  if (error) return fail(dbErrorKey(error));
  return ok((data ?? []).length);
}

export async function anonymizeOldClientsAction(years: number): Promise<ActionResult<number>> {
  if (!Number.isInteger(years) || years < 1 || years > 20) return fail("invalidForm");
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { data, error } = await supabase.rpc("anonymize_old_clients", { p_agency: agency.id, p_years: years });
  if (error) return fail(dbErrorKey(error));
  return ok(data ?? 0);
}
