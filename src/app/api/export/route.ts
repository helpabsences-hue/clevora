import writeExcelFile from "write-excel-file/node";
import { NextResponse } from "next/server";
import { getActiveAgency } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SHEETS = [
  ["Voitures", "vehicles"],
  ["Clients", "clients"],
  ["Réservations", "reservations"],
  ["Paiements", "reservation_payments"],
  ["Entretiens", "maintenance_periods"],
  ["Charges", "charges"],
  ["Vidanges", "oil_changes"],
  ["Achats et crédits", "vehicle_finance"],
] as const;

type Cell = string | number | boolean | null;

function cell(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
  return JSON.stringify(v);
}

/**
 * Données: the whole agency in one Excel file (admins only — it contains money).
 * Read with the admin's own session, so RLS limits it to this agency.
 */
export async function GET() {
  const agency = await getActiveAgency();
  if (!agency || agency.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const supabase = await createClient();
  const sheets = [];
  for (const [title, table] of SHEETS) {
    const rows: Array<Record<string, unknown>> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select("*").eq("agency_id", agency.id).order("created_at").range(from, from + 999);
      if (error) return new NextResponse("Error", { status: 500 });
      rows.push(...(data as Array<Record<string, unknown>>));
      if (!data || data.length < 1000) break;
    }
    const columns = rows.length ? Object.keys(rows[0]).filter((k) => k !== "agency_id") : ["id"];
    sheets.push({
      sheet: title,
      stickyRowsCount: 1,
      data: [columns.map((c) => ({ value: c, fontWeight: "bold" as const })), ...rows.map((r) => columns.map((c) => cell(r[c])))],
    });
  }
  await supabase.from("activity_log").insert({ agency_id: agency.id, action: "data.export", entity: "agency", entity_id: agency.id, details: {} });
  const buffer = await writeExcelFile(sheets).toBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="parcolia-${agency.slug}-${dayKey(new Date())}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
