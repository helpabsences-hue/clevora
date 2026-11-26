"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";
import { chargeSchema } from "./schema";

const RECEIPT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const RECEIPT_MAX = 5 * 1024 * 1024;

function refresh() {
  revalidatePath("/[locale]/charges", "page");
  revalidatePath("/[locale]/statistics", "page");
}

/** Add / edit a charge (admins). FormData so a receipt photo can come along. */
export async function saveChargeAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const id = formData.get("id");
  const raw = {
    category: formData.get("category"),
    date: formData.get("date"),
    amount: Number(formData.get("amount")),
    vehicle_id: formData.get("vehicle_id") ?? "",
    campaign_name: formData.get("campaign_name") ?? "",
    note: formData.get("note") ?? "",
    is_recurring: formData.get("is_recurring") === "true",
  };
  const parsed = chargeSchema.safeParse(raw);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (id && (typeof id !== "string" || !z.uuid().safeParse(id).success)) return fail("forbidden");
  // New vidange charges come from the Vidange page only.
  if (!id && parsed.data.category === "vidange") return fail("invalidForm", { category: "required" });
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    if (!RECEIPT_TYPES[receipt.type]) return fail("invalidForm", { receipt: "receiptType" });
    if (receipt.size > RECEIPT_MAX) return fail("invalidForm", { receipt: "receiptSize" });
  }
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;

  let chargeId = typeof id === "string" ? id : "";
  if (chargeId) {
    const { data, error } = await supabase.from("charges").update(parsed.data).eq("id", chargeId).eq("agency_id", agency.id).select("id");
    if (error) return fail(dbErrorKey(error));
    if (!data?.length) return fail("notFound");
  } else {
    const { data, error } = await supabase.from("charges").insert({ ...parsed.data, agency_id: agency.id }).select("id").single();
    if (error || !data) return fail(dbErrorKey(error));
    chargeId = data.id;
  }

  if (receipt instanceof File && receipt.size > 0) {
    const path = `${agency.id}/charges/${chargeId}-${Date.now()}.${RECEIPT_TYPES[receipt.type]}`;
    const { error } = await supabase.storage.from("agency-docs").upload(path, receipt, { contentType: receipt.type });
    if (!error) await supabase.from("charges").update({ receipt_path: path }).eq("id", chargeId);
  }
  refresh();
  return ok({ id: chargeId });
}

export async function deleteChargeAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase.from("charges").delete().eq("id", id).eq("agency_id", guard.ctx.agency.id).select("id");
  if (error) return fail(dbErrorKey(error));
  if (!data?.length) return fail("notFound");
  refresh();
  return ok();
}

/** Short-lived link to view a receipt (private bucket). */
export async function receiptUrlAction(path: string): Promise<ActionResult<string>> {
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  if (!path.startsWith(`${guard.ctx.agency.id}/charges/`)) return fail("forbidden");
  const { data, error } = await guard.ctx.supabase.storage.from("agency-docs").createSignedUrl(path, 300);
  if (error || !data) return fail("notFound");
  return ok(data.signedUrl);
}
