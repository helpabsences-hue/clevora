"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getTranslations } from "next-intl/server";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";
import { kmSchema as km, oilSchema, type OilChangeInput } from "./schema";

export type { OilChangeInput };

function refresh() {
  revalidatePath("/[locale]", "layout");
}

/** "Vidange faite": staff too. Saves the history; prices become charges (admins only). */
export async function recordOilChangeAction(vehicleId: string, input: OilChangeInput): Promise<ActionResult> {
  if (!z.uuid().safeParse(vehicleId).success) return fail("forbidden");
  const parsed = oilSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const v = parsed.data;
  const { data: car } = await supabase.from("vehicles").select("current_km").eq("id", vehicleId).eq("agency_id", agency.id).maybeSingle();
  if (!car) return fail("notFound");
  const { error } = await supabase
    .from("vehicles")
    .update({ oil_last_km: v.km, oil_last_date: v.date, oil_next_km: v.next_km, current_km: Math.max(car.current_km, v.km) })
    .eq("id", vehicleId)
    .eq("agency_id", agency.id);
  if (error) return fail(dbErrorKey(error));
  const { error: histError } = await supabase.from("oil_changes").insert({
    agency_id: agency.id,
    vehicle_id: vehicleId,
    date: v.date,
    km: v.km,
    next_km: v.next_km,
    items: v.items.map((x) => x.item),
    note: v.note || null,
  });
  if (histError) return fail(dbErrorKey(histError));
  // One vidange = ONE "vidange" charge: the total in Montant, the items in the detail (money: admins only).
  const priced = v.items.filter((x) => x.price && x.price > 0);
  if (priced.length && agency.role === "admin") {
    const t = await getTranslations("oil");
    const kmLabel = new Intl.NumberFormat("fr-FR").format(v.km).replace(/\u202f|\u00a0/g, " ");
    const label = (x: (typeof priced)[number]) => (x.item === "autre" ? v.note || t("items.autre") : t(`items.${x.item}`));
    const { error: chargeError } = await supabase.from("charges").insert({
      agency_id: agency.id,
      vehicle_id: vehicleId,
      category: "vidange",
      amount: priced.reduce((sum, x) => sum + x.price!, 0),
      date: v.date,
      note: `${t("chargeNote", { km: kmLabel })} · ${priced.map(label).join(", ")}`.slice(0, 500),
    });
    if (chargeError) return fail(dbErrorKey(chargeError));
  }
  refresh();
  return ok();
}

/** Update the current km of a car (alerts everywhere follow). */
export async function updateKmAction(vehicleId: string, value: number): Promise<ActionResult> {
  if (!z.uuid().safeParse(vehicleId).success) return fail("forbidden");
  const parsed = km.safeParse(value);
  if (!parsed.success) return fail("invalidForm", { km: "number" });
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase
    .from("vehicles")
    .update({ current_km: parsed.data })
    .eq("id", vehicleId)
    .eq("agency_id", guard.ctx.agency.id)
    .select("id");
  if (error) return fail(dbErrorKey(error));
  if (!data?.length) return fail("notFound");
  refresh();
  return ok();
}
