import { NextResponse, type NextRequest } from "next/server";
import type { Locale } from "@/i18n/routing";
import { buildDigest, digestSize, type AlertCar } from "@/lib/alerts/compute";
import { alertChannels, type Recipient } from "@/lib/alerts/channels";
import { resolveBrandColor } from "@/lib/brand";
import { siteUrl } from "@/lib/env";
import { dayKey } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUsageAndWarn } from "@/lib/usage-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily job: creates this month's recurring charges, then sends the alerts
 * (insurance, technical visit, oil change, late returns): one
 * summary per agency to the chosen roles. Called once a day by a scheduler
 * (Vercel Cron or Supabase Cron) with `Authorization: Bearer CRON_SECRET`.
 * Sends at most once per agency per day unless ?force=1.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = request.nextUrl.searchParams.get("force") === "1";
  const onlyAgency = request.nextUrl.searchParams.get("agency");
  const sb = createAdminClient(); // the job runs without a user: service role, server only
  await sb.rpc("rate_limit_cleanup"); // forget old rate-limit windows
  const now = new Date();
  const today = dayKey(now);

  let query = sb
    .from("agencies")
    .select("id, name, brand_color, alert_days_before, alert_km_before, alert_roles, alerts_sent_on, subscription_status")
    .in("subscription_status", ["trial", "active", "past_due"]);
  if (onlyAgency) query = query.eq("id", onlyAgency);
  const { data: agencies, error } = await query;
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  const report: Array<{ agency: string; alerts: number; sent: number; skipped?: string }> = [];
  for (const a of agencies ?? []) {
    // Monthly recurring charges (rent, salaries…): created once per month
    await sb.rpc("generate_recurring_charges", { p_agency: a.id, p_month: today });
    if (!force && a.alerts_sent_on === today) {
      report.push({ agency: a.id, alerts: 0, sent: 0, skipped: "already_sent" });
      continue;
    }
    const [{ data: cars }, { data: late }, { data: members }] = await Promise.all([
      sb.from("vehicles").select("id, plate, brand_model, current_km, oil_next_km, insurance_expires_on, technical_visit_expires_on").eq("agency_id", a.id).eq("status", "active"),
      sb
        .from("reservations")
        .select("contract_number, end_at, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)")
        .eq("agency_id", a.id)
        .eq("status", "on_rental")
        .lt("end_at", now.toISOString()),
      sb
        .from("agency_members")
        .select("role, profile:profiles!agency_members_user_id_fkey(full_name, email, phone, preferred_locale)")
        .eq("agency_id", a.id)
        .eq("status", "active")
        .in("role", a.alert_roles),
    ]);
    const digest = buildDigest(
      (cars ?? []) as AlertCar[],
      (late ?? []).map((r) => ({
        contract_number: r.contract_number,
        end_at: r.end_at,
        client: r.client?.full_name ?? "",
        phone: r.client?.phone ?? null,
        car: `${r.vehicle?.brand_model ?? ""} · ${r.vehicle?.plate ?? ""}`,
      })),
      { alertDays: a.alert_days_before, alertKm: a.alert_km_before },
      now,
    );
    const size = digestSize(digest);
    let sent = 0;
    if (size > 0) {
      const recipients: Recipient[] = (members ?? []).map((m) => ({
        name: m.profile?.full_name ?? null,
        email: m.profile?.email ?? null,
        phone: m.profile?.phone ?? null,
        locale: (m.profile?.preferred_locale ?? "fr") as Locale,
      }));
      const ctx = { agencyName: a.name, brandColor: resolveBrandColor(a.brand_color).brand, appUrl: siteUrl("/dashboard") };
      for (const r of recipients) {
        for (const channel of alertChannels()) {
          if (!channel.canReach(r)) continue;
          try {
            await channel.send(r, digest, ctx);
            sent += 1;
          } catch {
            // keep going: one failing address must not block the others
          }
        }
      }
    }
    await sb.from("agencies").update({ alerts_sent_on: today }).eq("id", a.id);
    report.push({ agency: a.id, alerts: size, sent });
  }
  // Parcolia itself: warn the platform admins before the Supabase plan limits.
  const usage = onlyAgency ? [] : await checkUsageAndWarn().catch(() => []);
  return NextResponse.json({ date: today, agencies: report.length, report, usage: usage.map((u) => ({ metric: u.metric, pct: u.pct })) });
}
