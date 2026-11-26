"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getTranslations } from "next-intl/server";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";
import { formatDate } from "@/lib/format";
import { compareView, visionConfigured } from "@/lib/ai/vision";
import { missingViews, photoPointToDiagram, VIEWS, type View } from "@/lib/inspections/model";
import { carryOverDamages, modeFor } from "./queries";
import { damageSchema, KINDS, type DamageInput, type Kind } from "./schema";

const uuid = z.uuid();

function refresh(reservationId: string) {
  revalidatePath("/[locale]/inspections", "page");
  revalidatePath(`/[locale]/inspections/${reservationId}`, "page");
  revalidatePath(`/[locale]/inspections/${reservationId}/[kind]`, "page");
}

/** Every inspection action: logged in, in an agency, and the section is turned on in Paramètres. */
async function context() {
  const guard = await requireActionContext();
  if (guard.ok && !guard.ctx.agency.inspection.enabled) return fail("inspectionOff");
  return guard;
}

/** Open (or create) the departure / return inspection of a reservation. */
export async function startInspectionAction(reservationId: string, kind: Kind): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(reservationId).success || !KINDS.includes(kind)) return fail("forbidden");
  const guard = await context();
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { data: existing } = await supabase.from("inspections").select("id").eq("agency_id", agency.id).eq("reservation_id", reservationId).eq("kind", kind).maybeSingle();
  if (existing) return ok({ id: existing.id });
  const mode = await modeFor(supabase, agency.id, reservationId, kind, agency.inspection.mode);
  const { data, error } = await supabase.from("inspections").insert({ agency_id: agency.id, reservation_id: reservationId, kind, mode }).select("id").single();
  if (error) return fail(dbErrorKey(error));
  if (kind === "departure") {
    const t = await getTranslations("inspection");
    await carryOverDamages(supabase, agency.id, reservationId, data.id, (k) => t("carried", { number: k.contractNumber, date: formatDate(k.completedAt) }));
  }
  return ok({ id: data.id });
}

async function inspectionOf(id: string) {
  const guard = await context();
  if (!guard.ok) return { guard, row: null };
  const { data: row } = await guard.ctx.supabase.from("inspections").select("id, reservation_id, kind, completed_at, mode, video_path").eq("agency_id", guard.ctx.agency.id).eq("id", id).maybeSingle();
  return { guard, row };
}

/** The photo was uploaded by the browser to {agency}/inspections/{id}/{view}.jpg: record it. */
export async function savePhotoAction(inspectionId: string, view: View, path: string): Promise<ActionResult> {
  if (!uuid.safeParse(inspectionId).success || !VIEWS.includes(view)) return fail("forbidden");
  const { guard, row } = await inspectionOf(inspectionId);
  if (!guard.ok) return guard;
  if (!row) return fail("notFound");
  const { supabase, agency } = guard.ctx;
  if (row.mode !== "photos" || path !== `${agency.id}/inspections/${inspectionId}/${view}.jpg`) return fail("forbidden");
  const { error } = await supabase
    .from("inspection_photos")
    .upsert({ agency_id: agency.id, inspection_id: inspectionId, view, storage_path: path }, { onConflict: "inspection_id,view" });
  if (error) return fail(dbErrorKey(error));
  refresh(row.reservation_id);
  return ok();
}

/** The video was uploaded by the browser to {agency}/inspections/{id}/video: record it. */
export async function saveVideoAction(inspectionId: string, path: string): Promise<ActionResult> {
  if (!uuid.safeParse(inspectionId).success) return fail("forbidden");
  const { guard, row } = await inspectionOf(inspectionId);
  if (!guard.ok) return guard;
  if (!row) return fail("notFound");
  const { supabase, agency } = guard.ctx;
  if (row.mode !== "video" || path !== `${agency.id}/inspections/${inspectionId}/video`) return fail("forbidden");
  const { error } = await supabase.from("inspections").update({ video_path: path }).eq("agency_id", agency.id).eq("id", inspectionId);
  if (error) return fail(dbErrorKey(error));
  refresh(row.reservation_id);
  return ok();
}

export async function addDamageAction(inspectionId: string, input: DamageInput): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(inspectionId).success) return fail("forbidden");
  const parsed = damageSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const { guard, row } = await inspectionOf(inspectionId);
  if (!guard.ok) return guard;
  if (!row) return fail("notFound");
  const v = parsed.data;
  const { data, error } = await guard.ctx.supabase
    .from("inspection_damages")
    .insert({ agency_id: guard.ctx.agency.id, inspection_id: inspectionId, x: v.x, y: v.y, type: v.type, view: v.view, note: v.note || null })
    .select("id")
    .single();
  if (error) return fail(dbErrorKey(error));
  refresh(row.reservation_id);
  return ok({ id: data.id });
}

/** Remove a mark, or confirm an AI suggestion. */
export async function updateDamageAction(id: string, change: "remove" | "confirm"): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || !["remove", "confirm"].includes(change)) return fail("forbidden");
  const guard = await context();
  if (!guard.ok) return guard;
  const { supabase, agency } = guard.ctx;
  const { data: dmg } = await supabase.from("inspection_damages").select("id, inspection:inspections(reservation_id)").eq("agency_id", agency.id).eq("id", id).maybeSingle();
  if (!dmg) return fail("notFound");
  const q = change === "remove" ? supabase.from("inspection_damages").delete() : supabase.from("inspection_damages").update({ confirmed: true });
  const { error } = await q.eq("agency_id", agency.id).eq("id", id);
  if (error) return fail(dbErrorKey(error));
  const reservationId = (dmg.inspection as { reservation_id: string } | null)?.reservation_id;
  if (reservationId) refresh(reservationId);
  return ok();
}

/** Finish: the four faces must be photographed (photos), or the walk-around filmed (video). */
export async function completeInspectionAction(inspectionId: string, notes: string): Promise<ActionResult> {
  if (!uuid.safeParse(inspectionId).success) return fail("forbidden");
  const cleanNotes = String(notes ?? "").trim().slice(0, 1000);
  const { guard, row } = await inspectionOf(inspectionId);
  if (!guard.ok) return guard;
  if (!row) return fail("notFound");
  const { supabase, agency } = guard.ctx;
  if (row.mode === "video") {
    if (!row.video_path) return fail("videoMissing");
  } else {
    const { data: photos } = await supabase.from("inspection_photos").select("view").eq("agency_id", agency.id).eq("inspection_id", inspectionId);
    const missing = missingViews((photos ?? []).map((p) => p.view));
    if (missing.length) return fail("photosMissing", { photos: missing.join(",") });
  }
  const { error } = await supabase.from("inspections").update({ completed_at: new Date().toISOString(), notes: cleanNotes || null }).eq("agency_id", agency.id).eq("id", inspectionId);
  if (error) return fail(dbErrorKey(error));
  refresh(row.reservation_id);
  return ok();
}

/** Views that can be compared by the AI: photographed at departure AND at return. */
export async function aiViewsAction(reservationId: string): Promise<ActionResult<View[]>> {
  if (!uuid.safeParse(reservationId).success) return fail("forbidden");
  const guard = await context();
  if (!guard.ok) return guard;
  if (!visionConfigured()) return fail("aiNotConfigured");
  const { supabase, agency } = guard.ctx;
  const { data: quota } = await supabase.rpc("ai_quota", { p_agency: agency.id });
  if (!quota?.[0]?.plan_allows) return fail("aiNotInPlan");
  if (!quota[0].enabled) return fail("aiDisabled");
  const { data: ins } = await supabase.from("inspections").select("id, kind, photos:inspection_photos(view)").eq("agency_id", agency.id).eq("reservation_id", reservationId);
  const dep = (ins ?? []).find((i) => i.kind === "departure");
  const ret = (ins ?? []).find((i) => i.kind === "return");
  if (!dep || !ret) return fail("inspectionMissing");
  const depViews = new Set((dep.photos ?? []).map((p) => p.view));
  const views = VIEWS.filter((v) => depViews.has(v) && (ret.photos ?? []).some((p) => p.view === v));
  if (!views.length) return fail("inspectionMissing");
  await supabase.from("inspections").update({ ai_status: "running" }).eq("id", ret.id);
  return ok(views);
}

/**
 * AI comparison of ONE view (the browser calls it view after view, showing the
 * progress): new damages become unconfirmed suggestions on the return inspection.
 */
export async function compareViewAction(reservationId: string, view: View, last: boolean): Promise<ActionResult<{ found: number; retryAfter?: number }>> {
  if (!uuid.safeParse(reservationId).success || !VIEWS.includes(view)) return fail("forbidden");
  const guard = await context();
  if (!guard.ok) return guard;
  const { supabase, agency, user } = guard.ctx;
  const { data: ins } = await supabase
    .from("inspections")
    .select("id, kind, photos:inspection_photos(view, storage_path)")
    .eq("agency_id", agency.id)
    .eq("reservation_id", reservationId);
  const dep = (ins ?? []).find((i) => i.kind === "departure");
  const ret = (ins ?? []).find((i) => i.kind === "return");
  const before = dep?.photos?.find((p) => p.view === view)?.storage_path;
  const after = ret?.photos?.find((p) => p.view === view)?.storage_path;
  if (!ret || !before || !after) return fail("inspectionMissing");
  // The AI gets the small copies (fewer tokens): {view}-s.jpg next to each photo.
  const small = (p: string) => p.replace(/\.jpg$/, "-s.jpg");
  const download = async (p: string) => {
    const { data } = await supabase.storage.from("agency-docs").download(small(p));
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  };
  const [b, a] = await Promise.all([download(before), download(after)]);
  if (!b || !a) return fail("inspectionMissing");
  const result = await compareView(view, b, a);
  if (!result.ok) {
    if (result.error === "busy") return ok({ found: 0, retryAfter: result.retryAfter });
    if (last) await supabase.from("inspections").update({ ai_status: "failed" }).eq("id", ret.id);
    return fail(result.error === "notConfigured" ? "aiNotConfigured" : "aiUnavailable");
  }
  // A new comparison replaces the previous, still unconfirmed, suggestions of this view.
  await supabase.from("inspection_damages").delete().eq("agency_id", agency.id).eq("inspection_id", ret.id).eq("view", view).eq("source", "ai").eq("confirmed", false);
  if (result.findings.length) {
    const { error } = await supabase.from("inspection_damages").insert(
      result.findings.map((f) => {
        const pt = photoPointToDiagram(view, f.x, f.y);
        return { agency_id: agency.id, inspection_id: ret.id, x: pt.x, y: pt.y, type: f.type, view, note: f.description || null, source: "ai", confirmed: false };
      }),
    );
    if (error) return fail(dbErrorKey(error));
  }
  if (last) {
    await supabase.from("inspections").update({ ai_status: "done", ai_checked_at: new Date().toISOString() }).eq("id", ret.id);
    await supabase.from("activity_log").insert({ agency_id: agency.id, actor_id: user.id, action: "inspection.ai_compare", entity: "reservation", entity_id: reservationId, details: {} });
  }
  refresh(reservationId);
  return ok({ found: result.findings.length });
}
