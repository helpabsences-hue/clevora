import { z } from "zod";
import { parseMoney } from "@/lib/format";

/**
 * Car import: map spreadsheet headers (French or English) to fields, then
 * validate each row. Shared by the browser (preview) and the server (save).
 */
export const IMPORT_FIELDS = [
  "plate",
  "brand_model",
  "category",
  "fuel",
  "gearbox",
  "daily_rate",
  "current_km",
  "first_registration_date",
  "insurance_expires_on",
  "technical_visit_expires_on",
  "oil_last_km",
  "oil_last_date",
  "oil_next_km",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Header words that identify each field (checked after normalisation). */
const SYNONYMS: Record<ImportField, string[]> = {
  plate: ["matricule", "immatriculation", "plaque", "plate", "registration", "license plate"],
  brand_model: ["modele", "marque modele", "marque et modele", "vehicule", "voiture", "model", "brand model", "car"],
  category: ["categorie", "category", "type", "gamme"],
  fuel: ["carburant", "energie", "fuel"],
  gearbox: ["boite", "boite de vitesse", "boite vitesse", "transmission", "gearbox"],
  daily_rate: ["prix jour", "prix par jour", "tarif", "tarif jour", "prix", "daily rate", "price per day", "rate"],
  current_km: ["km", "kilometrage", "km actuel", "kilometrage actuel", "mileage", "current km", "odometer"],
  first_registration_date: ["mise en circulation", "date mise en circulation", "date de mise en circulation", "mec", "first registration", "registration date"],
  insurance_expires_on: ["fin assurance", "assurance", "date fin assurance", "insurance end", "insurance expiry", "insurance"],
  technical_visit_expires_on: ["fin visite", "visite technique", "fin visite technique", "date fin visite", "technical visit", "inspection"],
  oil_last_km: ["derniere vidange km", "km derniere vidange", "vidange km", "last oil change km", "oil last km"],
  oil_last_date: ["derniere vidange date", "date derniere vidange", "vidange date", "last oil change date", "oil last date"],
  oil_next_km: ["prochaine vidange km", "prochaine vidange", "km prochaine vidange", "next oil change km", "next oil change", "oil next km"],
};

/** headers → { field: column index }. Exact synonym first, then "starts with". */
export function mapHeaders(headers: string[]): Partial<Record<ImportField, number>> {
  const normalized = headers.map((h) => norm(String(h ?? "")));
  const result: Partial<Record<ImportField, number>> = {};
  const used = new Set<number>();
  for (const pass of ["exact", "prefix"] as const) {
    for (const field of IMPORT_FIELDS) {
      if (result[field] !== undefined) continue;
      const idx = normalized.findIndex(
        (h, i) =>
          !used.has(i) &&
          h !== "" &&
          SYNONYMS[field].some((s) => (pass === "exact" ? h === s : h.startsWith(s) || s.startsWith(h) && h.length >= 4)),
      );
      if (idx >= 0) {
        result[field] = idx;
        used.add(idx);
      }
    }
  }
  return result;
}

const CATEGORY: Record<string, string> = {
  economy: "economy", economique: "economy", eco: "economy", citadine: "economy",
  compact: "compact", compacte: "compact", berline: "compact",
  suv: "suv", "4x4": "suv",
  van: "van", utilitaire: "van", minibus: "van", monospace: "van",
  luxury: "luxury", luxe: "luxury", premium: "luxury", prestige: "luxury",
};
const FUEL: Record<string, string> = {
  essence: "essence", petrol: "essence", gasoline: "essence", sp: "essence",
  diesel: "diesel", gasoil: "diesel", gazoil: "diesel",
  hybride: "hybride", hybrid: "hybride",
  electrique: "electrique", electric: "electrique", ev: "electrique",
};
const GEARBOX: Record<string, string> = {
  manuelle: "manuelle", manuel: "manuelle", manual: "manuelle", bvm: "manuelle", m: "manuelle",
  automatique: "automatique", auto: "automatique", automatic: "automatique", bva: "automatique", a: "automatique",
};

export type CellValue = string | number | boolean | Date | null | undefined;

function text(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** dd/mm/yyyy, yyyy-mm-dd, Excel dates or serial numbers → yyyy-mm-dd (or null / "invalid"). */
export function parseDateCell(v: CellValue): string | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "invalid" : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return v > 1000 && v < 80_000 ? d.toISOString().slice(0, 10) : "invalid";
  }
  const s = String(v).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  return "invalid";
}

function validDate(y: number, mo: number, d: number): string | "invalid" {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return "invalid";
  return date.toISOString().slice(0, 10);
}

function intCell(v: CellValue): number | null | "invalid" {
  const s = text(v).replace(/[\s  ]/g, "").replace(/km$/i, "");
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : "invalid";
}

/** One car as it will be saved. Same rules as the vehicle form. */
export const importedVehicleSchema = z.object({
  plate: z.string().trim().min(2, { error: "plateRequired" }).max(20, { error: "plateTooLong" }),
  brand_model: z.string().trim().min(1, { error: "modelRequired" }).max(120),
  category: z.enum(["economy", "compact", "suv", "van", "luxury"], { error: "categoryUnknown" }),
  fuel: z.enum(["essence", "diesel", "hybride", "electrique"], { error: "fuelUnknown" }),
  gearbox: z.enum(["manuelle", "automatique"], { error: "gearboxUnknown" }),
  daily_rate: z.number({ error: "priceRequired" }).min(0).max(1_000_000),
  current_km: z.number().int().min(0).max(5_000_000),
  first_registration_date: z.iso.date().nullable(),
  insurance_expires_on: z.iso.date().nullable(),
  technical_visit_expires_on: z.iso.date().nullable(),
  oil_last_km: z.number().int().min(0).nullable(),
  oil_last_date: z.iso.date().nullable(),
  oil_next_km: z.number().int().min(0).nullable(),
});
export type ImportedVehicle = z.infer<typeof importedVehicleSchema>;

export type ParsedRow = { line: number; data: ImportedVehicle | null; errors: string[]; raw: Record<string, string> };

/** Turns raw spreadsheet rows (first row = headers) into validated cars with errors per row. */
export function parseImportRows(rows: CellValue[][]): {
  mapping: Partial<Record<ImportField, number>>;
  missing: ImportField[];
  rows: ParsedRow[];
} {
  const [header = [], ...body] = rows;
  const mapping = mapHeaders(header.map(text));
  const required: ImportField[] = ["plate", "brand_model", "category", "fuel", "gearbox", "daily_rate"];
  const missing = required.filter((f) => mapping[f] === undefined);
  const cell = (row: CellValue[], f: ImportField) => (mapping[f] === undefined ? undefined : row[mapping[f]!]);

  const parsed: ParsedRow[] = [];
  body.forEach((row, i) => {
    if (row.every((c) => text(c) === "")) return; // skip empty lines
    const errors: string[] = [];
    const raw = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, text(cell(row, f))]));
    const date = (f: ImportField) => {
      const d = parseDateCell(cell(row, f));
      if (d === "invalid") errors.push(`dateInvalid:${f}`);
      return d === "invalid" ? null : d;
    };
    const int = (f: ImportField) => {
      const n = intCell(cell(row, f));
      if (n === "invalid") errors.push(`numberInvalid:${f}`);
      return n === "invalid" ? null : n;
    };
    const price = parseMoney(text(cell(row, "daily_rate")));
    const candidate = {
      plate: text(cell(row, "plate")).toUpperCase(),
      brand_model: text(cell(row, "brand_model")),
      category: CATEGORY[norm(text(cell(row, "category")))] ?? text(cell(row, "category")),
      fuel: FUEL[norm(text(cell(row, "fuel")))] ?? text(cell(row, "fuel")),
      gearbox: GEARBOX[norm(text(cell(row, "gearbox")))] ?? text(cell(row, "gearbox")),
      daily_rate: price ?? undefined,
      current_km: int("current_km") ?? 0,
      first_registration_date: date("first_registration_date"),
      insurance_expires_on: date("insurance_expires_on"),
      technical_visit_expires_on: date("technical_visit_expires_on"),
      oil_last_km: int("oil_last_km"),
      oil_last_date: date("oil_last_date"),
      oil_next_km: int("oil_next_km"),
    };
    const result = importedVehicleSchema.safeParse(candidate);
    if (!result.success) for (const issue of result.error.issues) errors.push(issue.message);
    parsed.push({ line: i + 2, data: result.success && errors.length === 0 ? result.data : null, errors: [...new Set(errors)], raw });
  });

  // The same plate twice in the file: only the first one is kept
  const seen = new Set<string>();
  for (const r of parsed) {
    if (!r.data) continue;
    const key = r.data.plate.replace(/[\s\-./|]/g, "");
    if (seen.has(key)) {
      r.errors.push("duplicateInFile");
      r.data = null;
    }
    seen.add(key);
  }
  return { mapping, missing, rows: parsed };
}

/** Header row of the downloadable template (French). */
export const TEMPLATE_HEADERS = [
  "Matricule",
  "Modèle",
  "Catégorie",
  "Carburant",
  "Boîte",
  "Prix/jour",
  "Km",
  "Mise en circulation",
  "Fin assurance",
  "Fin visite",
  "Dernière vidange km",
  "Dernière vidange date",
  "Prochaine vidange km",
];
export const TEMPLATE_EXAMPLE = [
  "12345-A-6", "Dacia Logan", "Économique", "Diesel", "Manuelle", 250, 45000,
  "15/03/2022", "31/12/2026", "15/03/2027", 40000, "10/09/2026", 50000,
];
