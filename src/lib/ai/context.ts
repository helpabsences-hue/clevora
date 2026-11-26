import "server-only";
import { listVehicles } from "@/app/[locale]/(app)/fleet/queries";
import { dateStatus, oilStatus } from "@/lib/alerts/compute";
import type { VehicleStatus } from "@/lib/fleet/status";
import { casablancaToIso, dayKey, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { ToolContext } from "./tools";

const MAX_CARS = 80;
const MAX_LINES = 25;

function statusText(s: VehicleStatus): string {
  switch (s.kind) {
    case "maintenance":
      return `en maintenance (${s.reason}${s.until ? `, retour prévu ${formatDate(s.until)}` : ""})`;
    case "on_rental":
      return `en location jusqu'au ${formatDateTime(s.until)}`;
    case "blocked":
      return "bloquée (assurance expirée)";
    case "reserved_today":
      return `disponible, départ réservé aujourd'hui à ${formatDateTime(s.at).slice(-5)}`;
    case "sold":
      return "vendue";
    default:
      return "disponible";
  }
}

/**
 * Retrieval step of the assistant (RAG on the agency's own database).
 * Before every question we read a fresh, compact picture of THIS agency:
 * fleet and statuses, today's movements, late returns, papers and oil due,
 * the agency rules, and (admins only) this month's money.
 *
 * Every query runs with the user's own Supabase session (RLS) AND is filtered
 * on ctx.agencyId, so one agency's assistant can never see another agency.
 */
export async function buildAgencyContext(ctx: ToolContext, agencyName: string): Promise<string> {
  const { supabase, agencyId, role, now, alertDays, alertKm } = ctx;
  const today = dayKey(now);
  const startOfDay = casablancaToIso(today, "00:00");
  const endOfDay = casablancaToIso(today, "23:59");
  const monthStart = `${today.slice(0, 7)}-01`;

  const RES = "contract_number, start_at, end_at, status, signed_at, delivery_place, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)";
  const [cars, { data: departures }, { data: returns }, { data: late }, { data: rules }, { count: clientCount }, { count: upcomingCount }, money] = await Promise.all([
    listVehicles(supabase, agencyId, now),
    supabase.from("reservations").select(RES).eq("agency_id", agencyId).eq("status", "reserved").gte("start_at", startOfDay).lte("start_at", endOfDay).order("start_at"),
    supabase.from("reservations").select(RES).eq("agency_id", agencyId).eq("status", "on_rental").gte("end_at", now.toISOString()).lte("end_at", endOfDay).order("end_at"),
    supabase.from("reservations").select(RES).eq("agency_id", agencyId).eq("status", "on_rental").lt("end_at", now.toISOString()).order("end_at"),
    supabase
      .from("agencies")
      .select("min_driver_age, min_license_years, default_deposit, default_franchise, equipment_items, document_items, city, phone")
      .eq("id", agencyId)
      .single(),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
    supabase.from("reservations").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).eq("status", "reserved").gt("start_at", endOfDay),
    role === "admin"
      ? Promise.all([
          supabase.rpc("stats_daily", { p_agency: agencyId, p_from: monthStart, p_to: today }),
          supabase.from("reservation_totals").select("balance").eq("agency_id", agencyId).gt("balance", 0),
        ])
      : null,
  ]);

  type ResLine = { contract_number: string; start_at: string; end_at: string; delivery_place: string | null; signed_at: string | null; vehicle: { plate: string; brand_model: string } | null; client: { full_name: string; phone: string | null } | null };
  const resLine = (r: ResLine, at: string) =>
    `- ${formatDateTime(at)} · ${r.contract_number} · ${r.client?.full_name ?? "?"}${r.client?.phone ? ` (${r.client.phone})` : ""} · ${r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : "?"}${r.delivery_place ? ` · livraison : ${r.delivery_place}` : ""}`;

  const active = cars.filter((c) => c.status === "active");
  const count = (k: VehicleStatus["kind"]) => active.filter((c) => c.computed.kind === k).length;
  const lines: string[] = [];
  lines.push(`<donnees_agence agence="${agencyName}" date="${formatDate(today)}">`);
  lines.push(
    `Parc : ${active.length} voitures actives — ${count("available") + count("reserved_today")} disponibles, ${count("on_rental")} en location, ${count("maintenance")} en maintenance, ${count("blocked")} bloquées. ${clientCount ?? 0} clients enregistrés. ${upcomingCount ?? 0} réservations à venir après aujourd'hui.`,
  );

  lines.push("", "Voitures (modèle · matricule · état · prix/jour · km · fin assurance · fin visite · vidange) :");
  for (const c of active.slice(0, MAX_CARS)) {
    const ins = dateStatus(c.insurance_expires_on, today, alertDays);
    const vis = dateStatus(c.technical_visit_expires_on, today, alertDays);
    const oil = oilStatus(c.current_km, c.oil_next_km, alertKm);
    const oilText = oil.kmLeft === null ? "non renseignée" : oil.kmLeft <= 0 ? `dépassée de ${-oil.kmLeft} km` : `dans ${oil.kmLeft} km`;
    lines.push(
      `- ${c.brand_model} · ${c.plate} · ${statusText(c.computed)} · ${formatMoney(c.daily_rate)} · ${c.current_km} km · ${c.insurance_expires_on ? formatDate(c.insurance_expires_on) : "?"}${ins.state === "expired" ? " (EXPIRÉE)" : ins.state === "soon" ? " (bientôt)" : ""} · ${c.technical_visit_expires_on ? formatDate(c.technical_visit_expires_on) : "?"}${vis.state === "expired" ? " (EXPIRÉE)" : vis.state === "soon" ? " (bientôt)" : ""} · ${oilText}`,
    );
  }
  if (active.length > MAX_CARS) lines.push(`… et ${active.length - MAX_CARS} autres voitures (utilise les outils pour les détails).`);

  const block = (title: string, list: ResLine[] | null, at: (r: ResLine) => string) => {
    lines.push("", `${title} : ${list?.length ?? 0}`);
    for (const r of (list ?? []).slice(0, MAX_LINES)) lines.push(resLine(r, at(r)));
  };
  block("Retours en retard", late as unknown as ResLine[], (r) => r.end_at);
  block("Retours prévus aujourd'hui", returns as unknown as ResLine[], (r) => r.end_at);
  block("Départs prévus aujourd'hui", departures as unknown as ResLine[], (r) => r.start_at);

  if (rules) {
    lines.push(
      "",
      `Règles de l'agence : conducteur de ${rules.min_driver_age} ans minimum, ${rules.min_license_years} ans de permis minimum, caution par défaut ${formatMoney(rules.default_deposit)}, franchise par défaut ${formatMoney(rules.default_franchise)}.`,
      `Équipements vérifiés au départ : ${rules.equipment_items.join(", ") || "—"}. Documents remis : ${rules.document_items.join(", ") || "—"}.`,
    );
  }

  if (money) {
    const [{ data: daily }, { data: balances }] = money;
    const revenue = (daily ?? []).reduce((s, d) => s + Number(d.revenue), 0);
    const charges = (daily ?? []).reduce((s, d) => s + Number(d.charges), 0);
    const unpaid = (balances ?? []).reduce((s, b) => s + Number(b.balance), 0);
    lines.push(
      "",
      `Argent (administrateur) — ce mois-ci jusqu'à aujourd'hui : chiffre d'affaires ${formatMoney(revenue)}, charges ${formatMoney(charges)}, net ${formatMoney(revenue - charges)}. Reste à encaisser sur les réservations : ${formatMoney(unpaid)} (${balances?.length ?? 0} réservations).`,
    );
  }
  lines.push("</donnees_agence>");
  return lines.join("\n");
}
