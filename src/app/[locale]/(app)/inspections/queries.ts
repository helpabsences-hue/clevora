import type { Damage, View } from "@/lib/inspections/model";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Kind } from "./schema";

export type InspectionPhoto = { view: View; url: string | null; thumb: string | null };
export type InspectionMode = "photos" | "video";
export type InspectionData = {
  id: string;
  kind: Kind;
  mode: InspectionMode;
  /** Walk-around video (video mode), private 1-hour link. */
  videoUrl: string | null;
  completedAt: string | null;
  notes: string | null;
  aiStatus: "none" | "running" | "done" | "failed";
  aiCheckedAt: string | null;
  photos: InspectionPhoto[];
  damages: Damage[];
};

/** Both inspections of a reservation, with 1-hour private links to the photos. */
export async function getInspections(supabase: ServerSupabase, agencyId: string, reservationId: string): Promise<Record<Kind, InspectionData | null>> {
  const { data } = await supabase
    .from("inspections")
    .select("id, kind, mode, video_path, completed_at, notes, ai_status, ai_checked_at, photos:inspection_photos(view, storage_path), damages:inspection_damages(id, x, y, type, view, note, source, confirmed, created_at)")
    .eq("agency_id", agencyId)
    .eq("reservation_id", reservationId);
  const rows = data ?? [];
  const paths = rows.flatMap((r) => [...(r.photos ?? []).flatMap((p) => [p.storage_path, p.storage_path.replace(/\.jpg$/, "-s.jpg")]), ...(r.video_path ? [r.video_path] : [])]);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("agency-docs").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const out: Record<Kind, InspectionData | null> = { departure: null, return: null };
  for (const r of rows) {
    out[r.kind as Kind] = {
      id: r.id,
      kind: r.kind as Kind,
      mode: r.mode === "video" ? "video" : "photos",
      videoUrl: r.video_path ? (signed.get(r.video_path) ?? null) : null,
      completedAt: r.completed_at,
      notes: r.notes,
      aiStatus: r.ai_status as InspectionData["aiStatus"],
      aiCheckedAt: r.ai_checked_at,
      photos: (r.photos ?? []).map((p) => ({ view: p.view as View, url: signed.get(p.storage_path) ?? null, thumb: signed.get(p.storage_path.replace(/\.jpg$/, "-s.jpg")) ?? signed.get(p.storage_path) ?? null })),
      damages: (r.damages ?? [])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((d) => ({ id: d.id, x: Number(d.x), y: Number(d.y), type: d.type as Damage["type"], view: d.view as View | null, note: d.note, source: d.source as Damage["source"], confirmed: d.confirmed })),
    };
  }
  return out;
}

/** The mode of a new inspection: the return follows its departure, otherwise the agency setting. */
export async function modeFor(supabase: ServerSupabase, agencyId: string, reservationId: string, kind: Kind, fallback: InspectionMode): Promise<InspectionMode> {
  if (kind !== "return") return fallback;
  const { data } = await supabase.from("inspections").select("mode").eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("kind", "departure").maybeSingle();
  return data?.mode === "video" || data?.mode === "photos" ? data.mode : fallback;
}

export type KnownDamages = { damages: Damage[]; completedAt: string; contractNumber: string; reservationId: string };

/**
 * The car's damages as last seen: the most recent FINISHED inspection (departure or
 * return) of another rental of this car. Confirmed marks only.
 */
export async function getKnownDamages(supabase: ServerSupabase, agencyId: string, vehicleId: string, exceptReservation?: string): Promise<KnownDamages | null> {
  let q = supabase
    .from("inspections")
    .select(
      "reservation_id, completed_at, reservation:reservations!inspections_agency_id_reservation_id_fkey!inner(vehicle_id, contract_number), damages:inspection_damages(id, x, y, type, view, note, source, confirmed, created_at)",
    )
    .eq("agency_id", agencyId)
    .eq("reservation.vehicle_id", vehicleId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1);
  if (exceptReservation) q = q.neq("reservation_id", exceptReservation);
  const { data } = await q;
  const row = data?.[0];
  if (!row?.completed_at) return null;
  return {
    completedAt: row.completed_at,
    contractNumber: (row.reservation as unknown as { contract_number: string }).contract_number,
    reservationId: row.reservation_id,
    damages: (row.damages ?? [])
      .filter((d) => d.confirmed)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((d) => ({ id: d.id, x: Number(d.x), y: Number(d.y), type: d.type as Damage["type"], view: d.view as View | null, note: d.note, source: "staff" as const, confirmed: true })),
  };
}

/**
 * A new departure inspection starts with the damages the car already had (last
 * finished inspection): staff only remove what was repaired and add what is new.
 * Returns the copied marks (the caller builds the page from them).
 */
export async function carryOverDamages(supabase: ServerSupabase, agencyId: string, reservationId: string, inspectionId: string, note: (k: KnownDamages) => string): Promise<Damage[]> {
  const { data: r } = await supabase.from("reservations").select("vehicle_id").eq("agency_id", agencyId).eq("id", reservationId).maybeSingle();
  if (!r?.vehicle_id) return [];
  const known = await getKnownDamages(supabase, agencyId, r.vehicle_id, reservationId);
  if (!known?.damages.length) return [];
  const prefix = note(known);
  const { data } = await supabase
    .from("inspection_damages")
    .insert(
      known.damages.map((d) => {
        // Carried again: keep only the original words after the previous "… du dd/mm/yyyy"
        const original = (d.note ?? "").replace(/^.*\d{2}\/\d{2}\/\d{4}(?: · )?/, "");
        return { agency_id: agencyId, inspection_id: inspectionId, x: d.x, y: d.y, type: d.type, view: d.view, note: `${prefix}${original ? ` · ${original}` : ""}`.slice(0, 300) };
      }),
    )
    .select("id, x, y, type, view, note");
  return (data ?? []).map((d) => ({ id: d.id, x: Number(d.x), y: Number(d.y), type: d.type as Damage["type"], view: d.view as View | null, note: d.note, source: "staff" as const, confirmed: true }));
}
