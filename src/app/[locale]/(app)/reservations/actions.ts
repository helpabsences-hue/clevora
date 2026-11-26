"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";
import { casablancaToIso } from "@/lib/format";
import type { Database } from "@/types/database";
import {
  cancelSchema,
  driverSchema,
  extendSchema,
  ID_TYPES,
  paymentSchema,
  reservationSchema,
  returnSchema,
  type PaymentInput,
  type ReservationInput,
  type ReturnInput,
} from "./schema";

function refresh(id?: string) {
  revalidatePath("/[locale]", "layout");
  if (id) revalidatePath(`/[locale]/reservations/${id}`, "page");
}

function reservationError(error: { code?: string; message?: string; hint?: string } | null) {
  if (error?.code === "23505" && error.message?.includes("contract_number")) {
    return fail("contractNumberTaken", { contract_number: "contractNumberTaken" });
  }
  if (error?.hint === "reservation_not_editable") return fail("reservationNotEditable");
  if (error?.hint === "reservation_not_on_rental") return fail("reservationNotOnRental");
  if (error?.code === "23514" && error.message?.includes("signed")) return fail("signFirst");
  return fail(dbErrorKey(error));
}

// ---------------------------------------------------------------------------
// Wizard helpers
// ---------------------------------------------------------------------------

export type FoundClient = {
  id: string;
  fields: z.input<typeof driverSchema>;
  rentals: number;
  lastRentalAt: string | null;
};

/** Find a client of this agency by CIN / passport (normalised: uppercase, no spaces or dashes). */
export async function findClientAction(idType: string, idNumber: string): Promise<ActionResult<FoundClient | null>> {
  if (!(ID_TYPES as readonly string[]).includes(idType)) return ok(null);
  const norm = idNumber.toUpperCase().replace(/[\s\-.]/g, "");
  if (norm.length < 3) return ok(null);
  const guard = await requireActionContext({ write: false });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { data: c } = await supabase
    .from("clients")
    .select("id, id_type, id_number, full_name, phone, nationality, address, birth_date, birth_place, id_expires_on, license_number, license_issued_on, license_issued_place")
    .eq("agency_id", agency.id)
    .eq("id_type", idType)
    .eq("id_number_norm", norm)
    .maybeSingle();
  if (!c) return ok(null);
  const { data: rentals, count } = await supabase
    .from("reservations")
    .select("start_at", { count: "exact" })
    .eq("agency_id", agency.id)
    .or(`client_id.eq.${c.id},second_driver_id.eq.${c.id}`)
    .neq("status", "cancelled")
    .order("start_at", { ascending: false })
    .limit(1);
  return ok({
    id: c.id,
    rentals: count ?? 0,
    lastRentalAt: rentals?.[0]?.start_at ?? null,
    fields: {
      id_type: c.id_type as "cin" | "passport",
      id_number: c.id_number,
      full_name: c.full_name,
      phone: c.phone ?? "",
      nationality: c.nationality ?? "",
      address: c.address ?? "",
      birth_date: c.birth_date ?? "",
      birth_place: c.birth_place ?? "",
      id_expires_on: c.id_expires_on ?? "",
      license_number: c.license_number ?? "",
      license_issued_on: c.license_issued_on ?? "",
      license_issued_place: c.license_issued_place ?? "",
    },
  });
}

export type AvailableCar = {
  id: string;
  plate: string;
  brand_model: string;
  category: string;
  fuel: string;
  gearbox: string;
  daily_rate: number;
  current_km: number;
};

/** Cars free between the two dates, and how many are not (and why). */
export async function availabilityAction(
  start: { date: string; time: string },
  end: { date: string; time: string },
  excludeReservation?: string,
): Promise<ActionResult<{ available: AvailableCar[]; unavailable: { booked: number; maintenance: number; insurance: number } }>> {
  const dates = z
    .object({ sd: z.iso.date(), st: z.string().regex(/^\d{2}:\d{2}$/), ed: z.iso.date(), et: z.string().regex(/^\d{2}:\d{2}$/) })
    .safeParse({ sd: start.date, st: start.time, ed: end.date, et: end.time });
  if (!dates.success) return fail("invalidForm");
  const startIso = casablancaToIso(start.date, start.time);
  const endIso = casablancaToIso(end.date, end.time);
  if (endIso <= startIso) return fail("invalidForm", { end_date: "endBeforeStart" });
  const guard = await requireActionContext({ write: false });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const [{ data: availability }, { data: cars }] = await Promise.all([
    supabase.rpc("vehicle_availability", {
      p_agency: agency.id,
      p_start: startIso,
      p_end: endIso,
      ...(excludeReservation ? { p_exclude_reservation: excludeReservation } : {}),
    }),
    supabase
      .from("vehicles")
      .select("id, plate, brand_model, category, fuel, gearbox, daily_rate, current_km")
      .eq("agency_id", agency.id)
      .eq("status", "active")
      .order("brand_model"),
  ]);
  const reasons = new Map((availability ?? []).map((a) => [a.vehicle_id, a.reason]));
  const unavailable = { booked: 0, maintenance: 0, insurance: 0 };
  const available: AvailableCar[] = [];
  for (const c of cars ?? []) {
    const reason = reasons.get(c.id);
    if (reason === "booked" || reason === "maintenance" || reason === "insurance") unavailable[reason] += 1;
    else if (!reason) available.push({ ...c, daily_rate: Number(c.daily_rate) });
  }
  return ok({ available, unavailable });
}

/** Is this contract number already used in the agency? */
export async function contractNumberTakenAction(contractNumber: string, excludeId?: string): Promise<ActionResult<boolean>> {
  const value = contractNumber.trim();
  if (!value) return ok(false);
  const guard = await requireActionContext({ write: false });
  if (!guard.ok) return guard;
  let q = guard.ctx.supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", guard.ctx.agency.id)
    .eq("contract_number", value);
  if (excludeId) q = q.neq("id", excludeId);
  const { count } = await q;
  return ok((count ?? 0) > 0);
}

// ---------------------------------------------------------------------------
// Save (new or edit)
// ---------------------------------------------------------------------------

export async function saveReservationAction(input: ReservationInput, reservationId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (reservationId && !z.uuid().safeParse(reservationId).success) return fail("forbidden");
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const v = parsed.data;

  const payload = {
    contract_number: v.contract_number,
    vehicle_id: v.car_later || !v.vehicle_id ? null : v.vehicle_id,
    start_at: casablancaToIso(v.start_date, v.start_time),
    end_at: casablancaToIso(v.end_date, v.end_time),
    daily_price: v.daily_price,
    delivery: v.delivery,
    delivery_place: v.delivery ? v.delivery_place : "",
    return_place: v.delivery ? v.return_place : "",
    delivery_fee: v.delivery ? v.delivery_fee : 0,
    franchise: v.franchise,
    deposit_taken: v.deposit_taken,
    deposit_amount: v.deposit_taken ? v.deposit_amount : 0,
    deposit_method: v.deposit_method,
    km_out: v.km_out,
    fuel_out: v.fuel_out,
    equipment: v.equipment,
    documents_given: v.documents_given,
    notes: v.notes,
    advance: v.advance_amount > 0 ? { amount: v.advance_amount, method: v.advance_method } : null,
    driver1: v.driver1,
    driver2: v.has_driver2 && v.driver2 ? v.driver2 : null,
  };

  const { data, error } = await supabase.rpc("save_reservation", {
    p_agency: agency.id,
    p_reservation: reservationId ?? (null as unknown as string),
    p: payload,
  });
  if (error || !data) return reservationError(error);
  refresh(data);
  return ok({ id: data });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function updateReservation(
  id: string,
  patch: Database["public"]["Tables"]["reservations"]["Update"],
  onlyStatus?: string[],
): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  let q = guard.ctx.supabase.from("reservations").update(patch).eq("id", id).eq("agency_id", guard.ctx.agency.id);
  if (onlyStatus) q = q.in("status", onlyStatus);
  const { data, error } = await q.select("id");
  if (error) return reservationError(error);
  if (!data?.length) return fail("reservationStateChanged");
  refresh(id);
  return ok();
}

export async function signReservationAction(id: string): Promise<ActionResult> {
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  return updateReservation(id, { signed_at: new Date().toISOString(), signed_by: guard.ctx.user.id }, ["reserved", "on_rental"]);
}

export async function startRentalAction(id: string): Promise<ActionResult> {
  return updateReservation(id, { status: "on_rental" }, ["reserved"]);
}

export async function cancelReservationAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse({ reason });
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  return updateReservation(id, { status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: parsed.data.reason }, ["reserved"]);
}

/** New end date; availability is checked again (and the database refuses double booking). */
export async function extendReservationAction(id: string, endDate: string, endTime: string): Promise<ActionResult> {
  const parsed = extendSchema.safeParse({ end_date: endDate, end_time: endTime });
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (!z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { data: r } = await guard.ctx.supabase
    .from("reservations")
    .select("start_at, end_at, extended_days, status")
    .eq("id", id)
    .eq("agency_id", guard.ctx.agency.id)
    .maybeSingle();
  if (!r || !["reserved", "on_rental"].includes(r.status)) return fail("reservationStateChanged");
  const newEnd = casablancaToIso(parsed.data.end_date, parsed.data.end_time);
  if (newEnd <= r.end_at) return fail("invalidForm", { end_date: "extendAfterEnd" });
  const added = Math.max(0, Math.ceil((Date.parse(newEnd) - Date.parse(r.end_at)) / 86_400_000 - 1e-9));
  return updateReservation(id, { end_at: newEnd, extended_days: (r.extended_days ?? 0) + added });
}

export async function returnReservationAction(id: string, input: ReturnInput): Promise<ActionResult> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (!z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const v = parsed.data;
  const { error } = await guard.ctx.supabase.rpc("return_reservation", {
    p_agency: guard.ctx.agency.id,
    p_reservation: id,
    p: {
      actual_return_at: casablancaToIso(v.return_date, v.return_time),
      km_in: v.km_in,
      fuel_in: v.fuel_in,
      notes: v.notes,
      balance: v.balance_amount > 0 ? { amount: v.balance_amount, method: v.balance_method } : null,
      deposit_refund: v.refund_deposit && v.refund_amount > 0 ? { amount: v.refund_amount, method: v.refund_method } : null,
      damage: v.damage_amount > 0 ? { amount: v.damage_amount, note: v.damage_note } : null,
    },
  });
  if (error) {
    if (error.hint === "damage_over_franchise") return fail("invalidForm", { damage_amount: "damageOverFranchise" });
    if (error.hint === "refund_too_high") return fail("invalidForm", { refund_amount: "refundTooHigh" });
    if (error.code === "23514") return fail("invalidForm", { km_in: "kmInBeforeOut" });
    return reservationError(error);
  }
  refresh(id);
  revalidatePath("/[locale]/fleet", "page");
  return ok();
}

export async function addPaymentAction(reservationId: string, input: PaymentInput): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (!z.uuid().safeParse(reservationId).success) return fail("forbidden");
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { error } = await guard.ctx.supabase.from("reservation_payments").insert({
    agency_id: guard.ctx.agency.id,
    reservation_id: reservationId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    kind: parsed.data.kind,
    note: parsed.data.note || null,
  });
  if (error) return fail(dbErrorKey(error));
  refresh(reservationId);
  return ok();
}


/** Choose (or change) the car of a booked reservation, from the cars free on its dates. */
export async function assignVehicleAction(reservationId: string, vehicleId: string, newDailyPrice: number | null): Promise<ActionResult> {
  if (!z.uuid().safeParse(reservationId).success || !z.uuid().safeParse(vehicleId).success) return fail("forbidden");
  if (newDailyPrice !== null && !(Number.isFinite(newDailyPrice) && newDailyPrice >= 0 && newDailyPrice <= 10_000_000)) return fail("invalidForm");
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { error } = await supabase.rpc("assign_vehicle", {
    p_agency: agency.id,
    p_reservation: reservationId,
    p_vehicle: vehicleId,
    ...(newDailyPrice !== null ? { p_daily_price: newDailyPrice } : {}),
  });
  if (error) return fail(dbErrorKey(error));
  revalidatePath("/[locale]/contracts/[id]", "page");
  revalidatePath("/[locale]/reservations", "page");
  revalidatePath("/[locale]/dashboard", "page");
  return ok();
}

export type BulkReservationResult = { done: number; skipped: number };
const bulkIds = z.array(z.uuid()).min(1).max(500);

/** Cancel several reservations at once (staff and admins). Only bookings not started yet. */
export async function bulkCancelReservationsAction(ids: string[], reason: string): Promise<ActionResult<BulkReservationResult>> {
  const parsedIds = bulkIds.safeParse(ids);
  const parsed = cancelSchema.safeParse({ reason });
  if (!parsedIds.success) return fail("invalidForm");
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase
    .from("reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: parsed.data.reason })
    .eq("agency_id", guard.ctx.agency.id)
    .in("id", parsedIds.data)
    .eq("status", "reserved")
    .select("id");
  if (error) return reservationError(error);
  refresh();
  const done = data?.length ?? 0;
  return ok({ done, skipped: parsedIds.data.length - done });
}

/**
 * Delete several reservations (admins). Only those that never started: not signed,
 * no money received (the database checks it too). The others are skipped.
 */
export async function bulkDeleteReservationsAction(ids: string[]): Promise<ActionResult<BulkReservationResult>> {
  const parsedIds = bulkIds.safeParse(ids);
  if (!parsedIds.success) return fail("invalidForm");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  let done = 0;
  for (const id of parsedIds.data) {
    const { data, error } = await supabase.from("reservations").delete().eq("id", id).eq("agency_id", agency.id).select("id");
    if (error && error.hint !== "reservation_not_deletable") return reservationError(error);
    if (data?.length) done++;
  }
  refresh();
  return ok({ done, skipped: parsedIds.data.length - done });
}
