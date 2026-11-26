import "server-only";
import { z } from "zod";
import type { Role } from "@/lib/auth/session";
import { oilStatus, dateStatus } from "@/lib/alerts/compute";
import { casablancaToIso, dayKey, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { ServerSupabase } from "@/lib/supabase/server";

/** What a tool can use: the user's own Supabase client, so RLS applies to every query. */
export type ToolContext = {
  supabase: ServerSupabase;
  agencyId: string;
  role: Role;
  now: Date;
  alertDays: number;
  alertKm: number;
};

/** A link shown under the answer so the user can check where it came from. */
export type Source = { label: string; href: string };

export type ToolOutput = { data: unknown; sources: Source[] };

export type AssistantTool = {
  name: string;
  description: string;
  schema: z.ZodObject;
  /** Roles that may use the tool (default: everyone). Staff never get money tools. */
  roles?: Role[];
  run: (ctx: ToolContext, input: Record<string, unknown>) => Promise<ToolOutput>;
};

const isoDate = z.iso.date().describe("Date au format AAAA-MM-JJ (fuseau Africa/Casablanca)");
const time = z.string().regex(/^\d{2}:\d{2}$/).describe("Heure HH:MM");

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const RES_SELECT =
  "id, contract_number, start_at, end_at, actual_return_at, status, return_place, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)";

type ResRow = {
  id: string;
  contract_number: string | null;
  start_at: string;
  end_at: string;
  actual_return_at: string | null;
  status: string;
  return_place: string | null;
  vehicle: { plate: string; brand_model: string } | null;
  client: { full_name: string; phone: string | null } | null;
};

function resSource(r: { id: string; contract_number: string | null; client?: { full_name: string } | null }): Source {
  return { label: `${r.contract_number ?? "Réservation"}${r.client ? ` · ${r.client.full_name}` : ""}`, href: `/reservations/${r.id}` };
}

export const TOOLS: AssistantTool[] = [
  {
    name: "who_had_car",
    description:
      "Qui avait une voiture (matricule) à une date et heure données, ou pendant toute une journée si l'heure est inconnue. Pour les infractions, radars, accidents. Renvoie le conducteur, son téléphone et sa pièce d'identité.",
    schema: z.object({ plate: z.string().min(2).max(20).describe("Matricule, ex. 12345-A-6"), date: isoDate, time: time.optional() }),
    async run({ supabase, agencyId }, input) {
      const { plate, date, time: t } = input as { plate: string; date: string; time?: string };
      const from = casablancaToIso(date, t ?? "00:00");
      const to = t ? from : casablancaToIso(date, "23:59");
      const { data: ids, error } = await supabase.rpc("who_had_car", { p_agency: agencyId, p_plate: plate, p_from: from, p_to: to });
      if (error) throw error;
      const list = (ids ?? []) as unknown as string[];
      if (!list.length) return { data: { found: 0, note: "Aucune location de cette voiture à ce moment." }, sources: [] };
      const { data } = await supabase
        .from("reservations")
        .select(
          "id, contract_number, start_at, end_at, actual_return_at, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone, id_type, id_number), driver2:clients!reservations_agency_id_second_driver_id_fkey(full_name, phone, id_type, id_number)",
        )
        .eq("agency_id", agencyId)
        .in("id", list);
      const rows = data ?? [];
      return {
        data: rows.map((r) => ({
          contrat: r.contract_number,
          voiture: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : null,
          du: formatDateTime(r.start_at),
          au: formatDateTime(r.actual_return_at ?? r.end_at),
          conducteur: r.client,
          deuxieme_conducteur: r.driver2,
        })),
        sources: rows.map(resSource),
      };
    },
  },
  {
    name: "upcoming_returns",
    description: "Voitures à récupérer : retours en retard et retours prévus dans les prochains jours.",
    schema: z.object({ days: z.number().int().min(0).max(31).default(2).describe("Nombre de jours à regarder (0 = aujourd'hui)") }),
    async run({ supabase, agencyId, now }, input) {
      const days = (input.days as number | undefined) ?? 2;
      const until = casablancaToIso(addDays(dayKey(now), days), "23:59");
      const { data, error } = await supabase
        .from("reservations")
        .select(RES_SELECT)
        .eq("agency_id", agencyId)
        .eq("status", "on_rental")
        .lte("end_at", until)
        .order("end_at");
      if (error) throw error;
      const rows = (data ?? []) as unknown as ResRow[];
      return {
        data: rows.map((r) => ({
          contrat: r.contract_number,
          client: r.client?.full_name,
          telephone: r.client?.phone,
          voiture: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : null,
          retour_prevu: formatDateTime(r.end_at),
          en_retard: new Date(r.end_at) < now,
          lieu: r.return_place,
        })),
        sources: rows.map(resSource),
      };
    },
  },
  {
    name: "upcoming_departures",
    description: "Départs (réservations à livrer ou à remettre au client) dans les prochains jours.",
    schema: z.object({ days: z.number().int().min(0).max(31).default(2) }),
    async run({ supabase, agencyId, now }, input) {
      const days = (input.days as number | undefined) ?? 2;
      const until = casablancaToIso(addDays(dayKey(now), days), "23:59");
      const { data, error } = await supabase
        .from("reservations")
        .select(RES_SELECT)
        .eq("agency_id", agencyId)
        .eq("status", "reserved")
        .lte("start_at", until)
        .order("start_at");
      if (error) throw error;
      const rows = (data ?? []) as unknown as ResRow[];
      return {
        data: rows.map((r) => ({
          contrat: r.contract_number,
          client: r.client?.full_name,
          telephone: r.client?.phone,
          voiture: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : null,
          depart: formatDateTime(r.start_at),
        })),
        sources: rows.map(resSource),
      };
    },
  },
  {
    name: "car_availability",
    description: "Voitures libres sur une période (pas réservées, pas en entretien, assurance valide).",
    schema: z.object({ start_date: isoDate, start_time: time.default("10:00"), end_date: isoDate, end_time: time.default("10:00") }),
    async run({ supabase, agencyId }, input) {
      const i = input as { start_date: string; start_time?: string; end_date: string; end_time?: string };
      const start = casablancaToIso(i.start_date, i.start_time ?? "10:00");
      const end = casablancaToIso(i.end_date, i.end_time ?? "10:00");
      if (end <= start) return { data: { error: "La fin doit être après le début." }, sources: [] };
      const [{ data: busy, error }, { data: cars }] = await Promise.all([
        supabase.rpc("vehicle_availability", { p_agency: agencyId, p_start: start, p_end: end }),
        supabase.from("vehicles").select("id, plate, brand_model, category, daily_rate").eq("agency_id", agencyId).eq("status", "active").order("brand_model"),
      ]);
      if (error) throw error;
      const reasons = new Map((busy ?? []).map((b) => [b.vehicle_id, b.reason]));
      const free = (cars ?? []).filter((c) => !reasons.has(c.id));
      return {
        data: {
          libres: free.map((c) => ({ voiture: `${c.brand_model} ${c.plate}`, categorie: c.category, prix_jour: formatMoney(c.daily_rate) })),
          indisponibles: (cars ?? []).filter((c) => reasons.has(c.id)).map((c) => ({ voiture: `${c.brand_model} ${c.plate}`, raison: reasons.get(c.id) })),
        },
        sources: [{ label: "Planning", href: `/planning?week=${i.start_date}` }],
      };
    },
  },
  {
    name: "oil_due",
    description: "Voitures dont la vidange est dépassée ou proche (en km).",
    schema: z.object({}),
    async run({ supabase, agencyId, alertKm }) {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, brand_model, current_km, oil_next_km")
        .eq("agency_id", agencyId)
        .eq("status", "active");
      if (error) throw error;
      const rows = (data ?? [])
        .map((c) => ({ ...c, s: oilStatus(c.current_km, c.oil_next_km, alertKm) }))
        .filter((c) => c.s.state === "due" || c.s.state === "soon")
        .sort((a, b) => (a.s.kmLeft ?? 0) - (b.s.kmLeft ?? 0));
      return {
        data: rows.map((c) => ({ voiture: `${c.brand_model} ${c.plate}`, km_actuel: c.current_km, vidange_a: c.oil_next_km, km_restants: c.s.kmLeft })),
        sources: rows.length ? [{ label: "Vidange", href: "/oil" }] : [],
      };
    },
  },
  {
    name: "insurance_due",
    description: "Assurances et visites techniques expirées ou qui expirent bientôt.",
    schema: z.object({}),
    async run({ supabase, agencyId, alertDays, now }) {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, brand_model, insurance_expires_on, technical_visit_expires_on")
        .eq("agency_id", agencyId)
        .eq("status", "active");
      if (error) throw error;
      const today = dayKey(now);
      const out: Array<{ voiture: string; papier: string; date: string; jours_restants: number }> = [];
      for (const c of data ?? []) {
        for (const [papier, date] of [["assurance", c.insurance_expires_on], ["visite technique", c.technical_visit_expires_on]] as const) {
          const s = dateStatus(date, today, alertDays);
          if (date && (s.state === "expired" || s.state === "soon")) out.push({ voiture: `${c.brand_model} ${c.plate}`, papier, date: formatDate(date), jours_restants: s.daysLeft ?? 0 });
        }
      }
      out.sort((a, b) => a.jours_restants - b.jours_restants);
      return { data: out, sources: out.length ? [{ label: "Assurance", href: "/insurance" }] : [] };
    },
  },
  {
    name: "find_reservations",
    description: "Chercher des réservations ou contrats par nom de client, téléphone, matricule ou numéro de contrat.",
    schema: z.object({ query: z.string().min(2).max(60) }),
    async run({ supabase, agencyId }, input) {
      const { data: ids, error } = await supabase.rpc("search_reservation_ids", { p_agency: agencyId, p_q: String(input.query) });
      if (error) throw error;
      const list = ((ids ?? []) as unknown as string[]).slice(0, 10);
      if (!list.length) return { data: [], sources: [] };
      const { data } = await supabase.from("reservations").select(RES_SELECT).eq("agency_id", agencyId).in("id", list).order("start_at", { ascending: false });
      const rows = (data ?? []) as unknown as ResRow[];
      return {
        data: rows.map((r) => ({
          contrat: r.contract_number,
          client: r.client?.full_name,
          telephone: r.client?.phone,
          voiture: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : null,
          du: formatDateTime(r.start_at),
          au: formatDateTime(r.actual_return_at ?? r.end_at),
          statut: r.status,
        })),
        sources: rows.map(resSource),
      };
    },
  },
  {
    name: "find_client",
    description:
      "Chercher un client de l'agence par nom, téléphone ou numéro de CIN/passeport. Renvoie ses coordonnées, son nombre de locations et ses dernières locations.",
    schema: z.object({ query: z.string().min(2).max(60).describe("Nom, téléphone ou CIN") }),
    async run({ supabase, agencyId }, input) {
      // Only letters, digits, spaces and dashes reach the filter (no PostgREST syntax).
      const q = String(input.query).replace(/[^\p{L}\p{N} -]/gu, " ").trim();
      if (q.length < 2) return { data: [], sources: [] };
      const digits = q.replace(/\D/g, "").replace(/^0/, "");
      const ors = [`full_name.ilike.%${q}%`, `id_number.ilike.%${q}%`];
      if (digits.length >= 4) ors.push(`phone.ilike.%${digits}%`);
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone, email, id_type, id_number, nationality, license_number")
        .eq("agency_id", agencyId)
        .or(ors.join(","))
        .limit(8);
      if (error) throw error;
      const clients = data ?? [];
      if (!clients.length) return { data: { found: 0 }, sources: [] };
      const { data: res } = await supabase
        .from("reservations")
        .select("id, client_id, contract_number, start_at, end_at, status, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model)")
        .eq("agency_id", agencyId)
        .in("client_id", clients.map((c) => c.id))
        .order("start_at", { ascending: false });
      const rows = (res ?? []) as unknown as Array<{ id: string; client_id: string; contract_number: string; start_at: string; end_at: string; status: string; vehicle: { plate: string; brand_model: string } | null }>;
      return {
        data: clients.map((c) => {
          const mine = rows.filter((r) => r.client_id === c.id);
          return {
            nom: c.full_name,
            telephone: c.phone,
            email: c.email,
            piece: `${c.id_type === "passport" ? "Passeport" : "CIN"} ${c.id_number}`,
            permis: c.license_number,
            nationalite: c.nationality,
            nombre_locations: mine.length,
            dernieres_locations: mine.slice(0, 5).map((r) => ({ contrat: r.contract_number, du: formatDateTime(r.start_at), au: formatDateTime(r.end_at), statut: r.status, voiture: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : null })),
          };
        }),
        sources: rows.slice(0, 5).map((r) => ({ label: r.contract_number, href: `/contracts/${r.id}` })),
      };
    },
  },
  {
    name: "vehicle_history",
    description:
      "Tout sur une voiture de l'agence (par matricule ou modèle) : fiche, locations passées et à venir, entretiens. Pour les administrateurs, aussi ses charges.",
    schema: z.object({ car: z.string().min(2).max(40).describe("Matricule (ex. 12345-A-6) ou modèle (ex. Clio)") }),
    async run({ supabase, agencyId, role }, input) {
      const q = String(input.car);
      const { data: cars } = await supabase
        .from("vehicles")
        .select("id, plate, plate_norm, brand_model, category, fuel, gearbox, daily_rate, current_km, status, insurance_expires_on, technical_visit_expires_on, insurer, oil_last_km, oil_last_date, oil_next_km, first_registration_date")
        .eq("agency_id", agencyId);
      const norm = q.toUpperCase().replace(/[\s\-./|]/g, "");
      const found = (cars ?? []).filter((c) => c.plate_norm === norm || c.plate_norm?.includes(norm) || c.brand_model.toLowerCase().includes(q.toLowerCase())).slice(0, 3);
      if (!found.length) return { data: { found: 0 }, sources: [] };
      const ids = found.map((c) => c.id);
      const [{ data: res }, { data: maint }, charges] = await Promise.all([
        supabase
          .from("reservations")
          .select("id, vehicle_id, contract_number, start_at, end_at, actual_return_at, status, km_out, km_in, client:clients!reservations_agency_id_client_id_fkey(full_name, phone)")
          .eq("agency_id", agencyId)
          .in("vehicle_id", ids)
          .order("start_at", { ascending: false })
          .limit(30),
        supabase.from("maintenance_periods").select("vehicle_id, reason, starts_on, expected_end_on, ended_on, note").eq("agency_id", agencyId).in("vehicle_id", ids).order("starts_on", { ascending: false }).limit(15),
        role === "admin"
          ? supabase.from("charges").select("vehicle_id, date, category, amount, note").eq("agency_id", agencyId).in("vehicle_id", ids).order("date", { ascending: false }).limit(20)
          : Promise.resolve({ data: null }),
      ]);
      const reservations = (res ?? []) as unknown as Array<{ id: string; vehicle_id: string; contract_number: string; start_at: string; end_at: string; actual_return_at: string | null; status: string; km_out: number | null; km_in: number | null; client: { full_name: string; phone: string | null } | null }>;
      return {
        data: found.map((c) => ({
          voiture: `${c.brand_model} ${c.plate}`,
          fiche: { categorie: c.category, carburant: c.fuel, boite: c.gearbox, prix_jour: formatMoney(c.daily_rate), km: c.current_km, statut: c.status, mise_en_circulation: c.first_registration_date ? formatDate(c.first_registration_date) : null, assurance_jusquau: c.insurance_expires_on ? formatDate(c.insurance_expires_on) : null, assureur: c.insurer, visite_technique_jusquau: c.technical_visit_expires_on ? formatDate(c.technical_visit_expires_on) : null, derniere_vidange: c.oil_last_km !== null ? `${c.oil_last_km} km${c.oil_last_date ? ` le ${formatDate(c.oil_last_date)}` : ""}` : null, prochaine_vidange_km: c.oil_next_km },
          locations: reservations.filter((r) => r.vehicle_id === c.id).map((r) => ({ contrat: r.contract_number, client: r.client?.full_name, telephone: r.client?.phone, du: formatDateTime(r.start_at), au: formatDateTime(r.actual_return_at ?? r.end_at), statut: r.status, km_depart: r.km_out, km_retour: r.km_in })),
          entretiens: (maint ?? []).filter((m) => m.vehicle_id === c.id).map((m) => ({ raison: m.reason, du: formatDate(m.starts_on), fin: m.ended_on ? formatDate(m.ended_on) : m.expected_end_on ? `prévue ${formatDate(m.expected_end_on)}` : "en cours", note: m.note })),
          ...(charges.data ? { charges: charges.data.filter((x) => x.vehicle_id === c.id).map((x) => ({ date: formatDate(x.date), categorie: x.category, montant: formatMoney(x.amount), note: x.note })) } : {}),
        })),
        sources: found.map((c) => ({ label: `${c.brand_model} ${c.plate}`, href: `/fleet/${c.id}` })),
      };
    },
  },
  {
    name: "reservations_in_period",
    description: "Toutes les réservations de l'agence qui touchent une période (départs, locations en cours, retours), avec client, voiture et statut.",
    schema: z.object({ from: isoDate, to: isoDate }),
    async run({ supabase, agencyId }, input) {
      const { from, to } = input as { from: string; to: string };
      const { data, error } = await supabase
        .from("reservations")
        .select(RES_SELECT)
        .eq("agency_id", agencyId)
        .neq("status", "cancelled")
        .lte("start_at", casablancaToIso(to, "23:59"))
        .gte("end_at", casablancaToIso(from, "00:00"))
        .order("start_at")
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ResRow[];
      return {
        data: { nombre: rows.length, reservations: rows.map((r) => ({ contrat: r.contract_number, client: r.client?.full_name, telephone: r.client?.phone, voiture: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : null, du: formatDateTime(r.start_at), au: formatDateTime(r.actual_return_at ?? r.end_at), statut: r.status })) },
        sources: rows.slice(0, 8).map(resSource),
      };
    },
  },
  {
    name: "unpaid_balances",
    description: "Réservations dont le client doit encore de l'argent (reste à payer), les plus grosses d'abord.",
    schema: z.object({}),
    async run({ supabase, agencyId }) {
      const { data: totals, error } = await supabase.from("reservation_totals").select("id, total, paid, balance").eq("agency_id", agencyId).gt("balance", 0).order("balance", { ascending: false }).limit(30);
      if (error) throw error;
      const ids = (totals ?? []).map((x) => x.id);
      if (!ids.length) return { data: { nombre: 0 }, sources: [] };
      const { data } = await supabase.from("reservations").select(RES_SELECT).eq("agency_id", agencyId).in("id", ids).neq("status", "cancelled");
      const byId = new Map(((data ?? []) as unknown as ResRow[]).map((r) => [r.id, r]));
      const rows = (totals ?? []).filter((x) => byId.has(x.id));
      return {
        data: rows.map((x) => {
          const r = byId.get(x.id)!;
          return { contrat: r.contract_number, client: r.client?.full_name, telephone: r.client?.phone, voiture: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : null, total: formatMoney(x.total), paye: formatMoney(x.paid), reste: formatMoney(x.balance), statut: r.status };
        }),
        sources: rows.slice(0, 8).map((x) => resSource(byId.get(x.id)!)),
      };
    },
  },
  {
    name: "agency_rules",
    description: "Les règles de l'agence enregistrées dans Paramètres : âge minimum, années de permis, caution et franchise par défaut, équipements, documents remis, conditions générales du contrat.",
    schema: z.object({}),
    async run({ supabase, agencyId }) {
      const { data, error } = await supabase
        .from("agencies")
        .select("name, address, city, phone, email, min_driver_age, min_license_years, default_deposit, default_franchise, equipment_items, document_items, contract_terms")
        .eq("id", agencyId)
        .single();
      if (error) throw error;
      return {
        data: { ...data, default_deposit: formatMoney(data.default_deposit), default_franchise: formatMoney(data.default_franchise), contract_terms: data.contract_terms?.slice(0, 4000) ?? null },
        sources: [{ label: "Paramètres", href: "/settings?section=contract" }],
      };
    },
  },
  {
    name: "revenue",
    description: "Chiffre d'affaires (locations), frais de dégâts, charges et bénéfice net sur une période (réservé aux administrateurs).",
    roles: ["admin"],
    schema: z.object({ from: isoDate, to: isoDate }),
    async run({ supabase, agencyId }, input) {
      const { from, to } = input as { from: string; to: string };
      const [{ data, error }, { data: perCar }] = await Promise.all([
        supabase.rpc("stats_daily", { p_agency: agencyId, p_from: from, p_to: to }),
        supabase.rpc("stats_by_vehicle", { p_agency: agencyId, p_from: from, p_to: to }),
      ]);
      if (error) throw error;
      const revenue = (data ?? []).reduce((s, r) => s + Number(r.revenue), 0);
      const charges = (data ?? []).reduce((s, r) => s + Number(r.charges), 0);
      const damages = (data ?? []).reduce((s, r) => s + Number(r.damages), 0);
      const best = (perCar ?? []).map((c) => ({ voiture: `${c.brand_model} ${c.plate}`, ca: Number(c.revenue) })).sort((a, b) => b.ca - a.ca).slice(0, 3);
      return {
        data: { du: formatDate(from), au: formatDate(to), chiffre_affaires: formatMoney(revenue), frais_de_degats: formatMoney(damages), charges: formatMoney(charges), net: formatMoney(revenue + damages - charges), meilleures_voitures: best.map((b) => ({ ...b, ca: formatMoney(b.ca) })) },
        sources: [{ label: "Statistiques", href: `/statistics?period=custom&from=${from}&to=${to}` }],
      };
    },
  },
  {
    name: "charges",
    description: "Liste et total des charges (dépenses) sur une période, par catégorie (réservé aux administrateurs).",
    roles: ["admin"],
    schema: z.object({ from: isoDate, to: isoDate }),
    async run({ supabase, agencyId }, input) {
      const { from, to } = input as { from: string; to: string };
      const { data, error } = await supabase
        .from("charges")
        .select("date, category, amount, note, vehicle:vehicles!charges_agency_id_vehicle_id_fkey(plate, brand_model)")
        .eq("agency_id", agencyId)
        .gte("date", from)
        .lte("date", to)
        .order("date");
      if (error) throw error;
      const byCat = new Map<string, number>();
      for (const c of data ?? []) byCat.set(c.category, (byCat.get(c.category) ?? 0) + Number(c.amount));
      const total = [...byCat.values()].reduce((s, v) => s + v, 0);
      return {
        data: { total: formatMoney(total), par_categorie: Object.fromEntries([...byCat].map(([k, v]) => [k, formatMoney(v)])), nombre: data?.length ?? 0 },
        sources: [{ label: "Charges", href: `/charges?month=${from.slice(0, 7)}` }],
      };
    },
  },
];

/** The tools a role may use. Staff never see revenue or charges tools at all. */
export function toolsFor(role: Role): AssistantTool[] {
  return TOOLS.filter((t) => !t.roles || t.roles.includes(role));
}
