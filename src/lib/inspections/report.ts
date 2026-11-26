import "server-only";
import { getContractData, type ContractData } from "@/lib/contracts/data";
import type { ServerSupabase } from "@/lib/supabase/server";
import { newDamages, VIEWS, type Damage, type View } from "./model";

export type ReportSide = {
  mode: "photos" | "video";
  completedAt: string | null;
  notes: string | null;
  /** Confirmed marks only: unchecked AI suggestions never go on paper. */
  damages: Damage[];
  /** Small copies (768 px) of the photos, by view. */
  photos: Partial<Record<View, Buffer>>;
};

export type InspectionReport = {
  contract: ContractData;
  departure: ReportSide | null;
  return: ReportSide | null;
  /** Return damages that were not there at departure. */
  fresh: Damage[];
};

/** Everything the état des lieux PDF needs (RLS: only the user's agency). */
export async function getInspectionReport(supabase: ServerSupabase, agencyId: string, reservationId: string): Promise<InspectionReport | null> {
  const [contract, { data: rows }] = await Promise.all([
    getContractData(supabase, agencyId, reservationId),
    supabase
      .from("inspections")
      .select("kind, mode, completed_at, notes, photos:inspection_photos(view, storage_path), damages:inspection_damages(id, x, y, type, view, note, source, confirmed, created_at)")
      .eq("agency_id", agencyId)
      .eq("reservation_id", reservationId),
  ]);
  if (!contract || !rows?.length) return null;

  const side = async (kind: "departure" | "return"): Promise<ReportSide | null> => {
    const r = rows.find((x) => x.kind === kind);
    if (!r) return null;
    const photos: Partial<Record<View, Buffer>> = {};
    await Promise.all(
      (r.photos ?? [])
        .filter((p) => VIEWS.includes(p.view as View))
        .map(async (p) => {
          const { data } = await supabase.storage.from("agency-docs").download(p.storage_path.replace(/\.jpg$/, "-s.jpg"));
          if (data) photos[p.view as View] = Buffer.from(await data.arrayBuffer());
        }),
    );
    return {
      mode: r.mode === "video" ? "video" : "photos",
      completedAt: r.completed_at,
      notes: r.notes,
      damages: (r.damages ?? [])
        .filter((d) => d.confirmed)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((d) => ({ id: d.id, x: Number(d.x), y: Number(d.y), type: d.type as Damage["type"], view: d.view as View | null, note: d.note, source: d.source as Damage["source"], confirmed: true })),
      photos,
    };
  };
  const [departure, ret] = await Promise.all([side("departure"), side("return")]);
  return { contract, departure, return: ret, fresh: departure && ret ? newDamages(departure.damages, ret.damages) : [] };
}
