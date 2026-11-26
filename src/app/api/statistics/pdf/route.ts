import { NextResponse, type NextRequest } from "next/server";
import { getActiveAgency } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { occupancy, resolvePeriod, toBuckets, type DailyRow } from "@/lib/stats";
import { renderStatsPdf } from "@/lib/stats-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Statistics PDF report (admins only; the SQL functions refuse anyone else). */
export async function GET(request: NextRequest) {
  const agency = await getActiveAgency();
  if (!agency || agency.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const today = dayKey(new Date());
  const { from, to } = resolvePeriod(Object.fromEntries(request.nextUrl.searchParams), today);
  const supabase = await createClient();
  const [{ data: daily, error }, { data: perCar }, { count }, { data: info }] = await Promise.all([
    supabase.rpc("stats_daily", { p_agency: agency.id, p_from: from, p_to: to }),
    supabase.rpc("stats_by_vehicle", { p_agency: agency.id, p_from: from, p_to: to }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "active"),
    supabase.from("agencies").select("name").eq("id", agency.id).single(),
  ]);
  if (error) return new NextResponse("Forbidden", { status: 403 });
  const rows = (daily ?? []) as DailyRow[];
  const buckets = toBuckets(rows, from, to, today);
  const rentedDays = buckets.reduce((s, b) => s + b.rentedDays, 0);
  const pdf = await renderStatsPdf({
    agencyName: info?.name ?? agency.name,
    brand: agency.brandColor,
    from,
    to,
    totals: {
      revenue: buckets.reduce((s, b) => s + b.revenue, 0),
      charges: buckets.reduce((s, b) => s + b.charges, 0),
      damages: buckets.reduce((s, b) => s + b.damages, 0),
      rentedDays,
      occupancy: occupancy(rentedDays, count ?? 0, rows.length),
    },
    buckets: buckets.map((b) => ({ ...b, label: b.key.length === 7 ? `${b.key.slice(5)}/${b.key.slice(0, 4)}` : `${b.key.slice(8)}/${b.key.slice(5, 7)}` })),
    cars: (perCar ?? [])
      .map((c) => ({ ...c, revenue: Number(c.revenue), charges: Number(c.charges), net: Number(c.revenue) + Number(c.damages) - Number(c.charges), occupancy: occupancy(c.rented_days, 1, rows.length) }))
      .sort((a, b) => b.net - a.net),
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="statistiques-${from}-${to}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
