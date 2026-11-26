"use server";


import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";
import { financeSchema, type FinanceInput } from "@/lib/fleet/finance";
import { importedVehicleSchema, type ImportedVehicle } from "@/lib/fleet/import";
import { dayKey, formatDateTime, plateNorm } from "@/lib/format";
import { maintenanceSchema, vehicleSchema, type MaintenanceInput, type VehicleInput } from "./schema";

function refresh(id?: string) {
  revalidatePath("/[locale]/fleet", "page");
  if (id) revalidatePath("/[locale]/fleet/[id]", "page");
  revalidatePath("/[locale]", "layout"); // nav badges
}

function vehicleError(error: { code?: string; hint?: string } | null): ReturnType<typeof fail> {
  if (error?.code === "23505") return fail("plateTaken", { plate: "plateTaken" });
  return fail(dbErrorKey(error));
}

/** Add or edit a car (admins). */
export async function saveVehicleAction(input: VehicleInput, id?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (id && !z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const values = { ...parsed.data, plate: parsed.data.plate.toUpperCase() };

  if (id) {
    const { data, error } = await supabase.from("vehicles").update(values).eq("id", id).eq("agency_id", agency.id).select("id");
    if (error) return vehicleError(error);
    if (!data?.length) return fail("notFound");
    refresh(id);
    return ok({ id });
  }
  const { data, error } = await supabase
    .from("vehicles")
    .insert({ ...values, agency_id: agency.id })
    .select("id")
    .single();
  if (error || !data) return vehicleError(error);
  refresh();
  return ok({ id: data.id });
}

/** Delete a car (admins). Cars with reservations or charges are kept: mark them as sold instead. */
export async function deleteVehicleAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase.from("vehicles").delete().eq("id", id).eq("agency_id", guard.ctx.agency.id).select("id");
  if (error?.code === "23503") return fail("vehicleHasHistory");
  if (error) return fail(dbErrorKey(error));
  if (!data?.length) return fail("notFound");
  refresh();
  return ok();
}

/** Sold / back in the fleet (admins). */
export async function setVehicleSoldAction(id: string, sold: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase
    .from("vehicles")
    .update({ status: sold ? "sold" : "active" })
    .eq("id", id)
    .eq("agency_id", guard.ctx.agency.id)
    .select("id");
  if (error) return fail(dbErrorKey(error));
  if (!data?.length) return fail("notFound");
  refresh(id);
  return ok();
}

export type OverlappingReservation = { id: string; contract_number: string; client: string; start_at: string; end_at: string; startLabel: string; endLabel: string };

/** Reservations of this car that fall inside a planned maintenance (to warn before saving). */
export async function maintenanceOverlapsAction(
  vehicleId: string,
  startsOn: string,
  expectedEndOn: string | null,
): Promise<ActionResult<OverlappingReservation[]>> {
  const parsed = z
    .object({ vehicleId: z.uuid(), startsOn: z.iso.date(), expectedEndOn: z.iso.date().nullable() })
    .safeParse({ vehicleId, startsOn, expectedEndOn });
  if (!parsed.success) return ok([]);
  const guard = await requireActionContext({ write: false });
  if (!guard.ok) return guard;
  // From the first maintenance day (00:00) to the day after the expected end (or far away)
  const from = new Date(`${startsOn}T00:00:00Z`).getTime() - 2 * 3_600_000;
  const to = expectedEndOn ? new Date(`${expectedEndOn}T23:59:59Z`).getTime() : Date.now() + 365 * 86_400_000;
  const { data } = await guard.ctx.supabase
    .from("reservations")
    .select("id, contract_number, start_at, end_at, client:clients!reservations_agency_id_client_id_fkey(full_name)")
    .eq("agency_id", guard.ctx.agency.id)
    .eq("vehicle_id", vehicleId)
    .in("status", ["reserved", "on_rental"])
    .lt("start_at", new Date(to).toISOString())
    .gt("end_at", new Date(from).toISOString())
    .order("start_at");
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      contract_number: r.contract_number,
      client: r.client?.full_name ?? "",
      start_at: r.start_at,
      startLabel: formatDateTime(r.start_at),
      endLabel: formatDateTime(r.end_at),
      end_at: r.end_at,
    })),
  );
}

/** Put a car in maintenance (staff too). */
export async function startMaintenanceAction(input: MaintenanceInput): Promise<ActionResult> {
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const v = parsed.data;
  const { error } = await supabase.from("maintenance_periods").insert({
    agency_id: agency.id,
    vehicle_id: v.vehicleId,
    reason: v.reason,
    starts_on: v.starts_on,
    expected_end_on: v.expected_end_on,
    note: v.note || null,
  });
  if (error) return fail(dbErrorKey(error));
  refresh(v.vehicleId);
  return ok();
}

/** "Remettre en service": the car is available again from today. */
export async function endMaintenanceAction(periodId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(periodId).success) return fail("forbidden");
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const today = dayKey(new Date());
  const { data: period } = await guard.ctx.supabase
    .from("maintenance_periods")
    .select("id, vehicle_id, starts_on")
    .eq("id", periodId)
    .eq("agency_id", guard.ctx.agency.id)
    .maybeSingle();
  if (!period) return fail("notFound");
  const { error } = await guard.ctx.supabase
    .from("maintenance_periods")
    .update({ ended_on: period.starts_on > today ? period.starts_on : today })
    .eq("id", periodId);
  if (error) return fail(dbErrorKey(error));
  refresh(period.vehicle_id);
  return ok();
}

/** For the import preview: which plates already exist (they will be updated). */
export async function existingPlatesAction(): Promise<ActionResult<string[]>> {
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  const { data } = await guard.ctx.supabase.from("vehicles").select("plate_norm").eq("agency_id", guard.ctx.agency.id);
  return ok((data ?? []).map((v) => v.plate_norm ?? ""));
}

export type ImportResult = { created: number; updated: number; failed: Array<{ plate: string; error: string }> };

/** Import cars: existing plates are updated, new ones created (within the plan limit). */
export async function importVehiclesAction(rows: ImportedVehicle[]): Promise<ActionResult<ImportResult>> {
  const parsed = z.array(importedVehicleSchema).max(1000).safeParse(rows);
  if (!parsed.success) return fail("invalidForm");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;

  const { data: existing } = await supabase.from("vehicles").select("id, plate_norm").eq("agency_id", agency.id);
  const byPlate = new Map((existing ?? []).map((v) => [v.plate_norm, v.id]));
  const result: ImportResult = { created: 0, updated: 0, failed: [] };

  const toCreate: ImportedVehicle[] = [];
  for (const row of parsed.data) {
    const values = { ...row, plate: row.plate.toUpperCase() };
    const id = byPlate.get(plateNorm(row.plate));
    if (!id) {
      toCreate.push(values);
      continue;
    }
    const { error } = await supabase.from("vehicles").update(values).eq("id", id).eq("agency_id", agency.id);
    if (error) result.failed.push({ plate: row.plate, error: dbErrorKey(error) });
    else result.updated += 1;
  }
  // New cars one by one so the plan limit stops exactly at the limit with a clear message
  for (const row of toCreate) {
    const { error } = await supabase.from("vehicles").insert({ ...row, agency_id: agency.id });
    if (error) result.failed.push({ plate: row.plate, error: error.code === "23505" ? "plateTaken" : dbErrorKey(error) });
    else result.created += 1;
  }
  refresh();
  return ok(result);
}

/** Achat et crédit of a car: admins only (RLS checks it again). */
export async function saveFinanceAction(vehicleId: string, input: FinanceInput): Promise<ActionResult> {
  if (!z.uuid().safeParse(vehicleId).success) return fail("forbidden");
  const parsed = financeSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { error } = await supabase
    .from("vehicle_finance")
    .upsert({ agency_id: agency.id, vehicle_id: vehicleId, ...parsed.data }, { onConflict: "agency_id,vehicle_id" });
  if (error) return fail(dbErrorKey(error));
  refresh(vehicleId);
  revalidatePath("/[locale]/statistics", "page");
  return ok();
}

export async function deleteFinanceAction(vehicleId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(vehicleId).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { error } = await supabase.from("vehicle_finance").delete().eq("agency_id", agency.id).eq("vehicle_id", vehicleId);
  if (error) return fail(dbErrorKey(error));
  refresh(vehicleId);
  revalidatePath("/[locale]/statistics", "page");
  return ok();
}

export type BulkVehicleResult = { deleted: number; kept: Array<{ id: string; label: string }> };

/**
 * Delete several cars (admins). A car with history (rentals, charges, maintenance)
 * cannot be deleted: it is kept and listed, so it can be marked "vendue" instead.
 */
export async function bulkDeleteVehiclesAction(ids: string[]): Promise<ActionResult<BulkVehicleResult>> {
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return fail("invalidForm");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { data: cars } = await supabase.from("vehicles").select("id, plate, brand_model").eq("agency_id", agency.id).in("id", parsed.data);
  let deleted = 0;
  const kept: BulkVehicleResult["kept"] = [];
  for (const car of cars ?? []) {
    const { error } = await supabase.from("vehicles").delete().eq("id", car.id).eq("agency_id", agency.id);
    if (!error) deleted++;
    else if (error.code === "23503") kept.push({ id: car.id, label: `${car.brand_model} · ${car.plate}` });
    else return fail(dbErrorKey(error));
  }
  refresh();
  return ok({ deleted, kept });
}

/** Mark several cars as sold (admins). They leave the fleet but keep their history. */
export async function bulkSetSoldAction(ids: string[]): Promise<ActionResult<number>> {
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return fail("invalidForm");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase
    .from("vehicles")
    .update({ status: "sold" })
    .eq("agency_id", guard.ctx.agency.id)
    .in("id", parsed.data)
    .select("id");
  if (error) return fail(dbErrorKey(error));
  refresh();
  return ok(data?.length ?? 0);
}
