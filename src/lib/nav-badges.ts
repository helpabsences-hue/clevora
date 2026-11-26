import "server-only";
import type { NavBadges } from "@/components/app/shell/nav-config";
import { casablancaToIso, isoToCasablanca } from "@/lib/format";
import type { ServerSupabase } from "@/lib/supabase/server";

function isoDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Counts for the navigation badges (only urgent things):
 *  - Réservations: returns that are late
 *  - Contrats: reservations leaving within 24 h and not signed yet
 *  - Assurance: insurance or technical visit ending within alert_days_before
 *  - Vidange: oil change due within alert_km_before
 *  - Inspection (when turned on): departures and returns of today (or late) not inspected yet
 */
export async function getNavBadges(supabase: ServerSupabase, agencyId: string, options: { inspection?: boolean } = {}): Promise<NavBadges> {
  const nowIso = new Date().toISOString();
  const { data: agency } = await supabase
    .from("agencies")
    .select("alert_days_before, alert_km_before")
    .eq("id", agencyId)
    .maybeSingle();
  const alertDays = agency?.alert_days_before ?? 30;
  const alertKm = agency?.alert_km_before ?? 1500;
  const limitDay = isoDay(alertDays);

  const [late, toSign, insurance, cars] = await Promise.all([
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "on_rental")
      .lt("end_at", nowIso),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "reserved")
      .is("signed_at", null)
      .lt("start_at", new Date(Date.now() + 86_400_000).toISOString()),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "active")
      .or(`insurance_expires_on.lte.${limitDay},technical_visit_expires_on.lte.${limitDay}`),
    supabase
      .from("vehicles")
      .select("current_km, oil_next_km")
      .eq("agency_id", agencyId)
      .eq("status", "active")
      .not("oil_next_km", "is", null),
  ]);

  const oilDue = (cars.data ?? []).filter((c) => (c.oil_next_km ?? Infinity) - c.current_km <= alertKm).length;

  const badges: NavBadges = {};
  if (late.count) badges.reservations = { count: late.count, tone: "danger" };
  if (toSign.count) badges.contracts = { count: toSign.count, tone: "warning" };
  if (insurance.count) badges.insurance = { count: insurance.count, tone: "warning" };
  if (oilDue) badges.oil = { count: oilDue, tone: "warning" };
  if (options.inspection) {
    const count = await inspectionsDue(supabase, agencyId);
    if (count) badges.inspections = { count, tone: "warning" };
  }
  return badges;
}

/** Cars leaving or coming back by the end of today (or late) whose inspection is not done. */
async function inspectionsDue(supabase: ServerSupabase, agencyId: string): Promise<number> {
  // End of today in Casablanca (agencies work on local days)
  const until = casablancaToIso(isoToCasablanca(new Date().toISOString()).date, "23:59");
  const { data } = await supabase
    .from("reservations")
    .select("status, vehicle_id, start_at, end_at, inspections!inspections_agency_id_reservation_id_fkey(kind, completed_at)")
    .eq("agency_id", agencyId)
    .or(`and(status.eq.reserved,start_at.lte.${until}),and(status.eq.on_rental,end_at.lte.${until})`)
    .limit(500);
  return (data ?? []).filter((r) => {
    const kind = r.status === "reserved" ? "departure" : "return";
    if (kind === "departure" && !r.vehicle_id) return false;
    return !(r.inspections ?? []).some((i) => i.kind === kind && i.completed_at);
  }).length;
}
