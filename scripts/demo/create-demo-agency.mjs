#!/usr/bin/env node
/**
 * Creates ONE demo agency with fake data on an online Supabase project (for sales demos).
 * It never touches other agencies, and refuses to run twice.
 * seed.sql is for local development only: never run it on production.
 *
 * Usage (PowerShell or bash), with the PRODUCTION values in the environment:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   DEMO_PASSWORD='a long password' \
 *   node scripts/demo/create-demo-agency.mjs
 *
 * Optional: DEMO_ADMIN_EMAIL (default demo@parcolia.ma), DEMO_STAFF_EMAIL (default demo-staff@parcolia.ma),
 *           DEMO_SLUG (default agence-demo), DEMO_NAME (default "Agence Démo").
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.production.local")) process.loadEnvFile(".env.production.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
const adminEmail = process.env.DEMO_ADMIN_EMAIL ?? "demo@parcolia.ma";
const staffEmail = process.env.DEMO_STAFF_EMAIL ?? "demo-staff@parcolia.ma";
const slug = process.env.DEMO_SLUG ?? "agence-demo";
const name = process.env.DEMO_NAME ?? "Agence Démo";

function stop(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
if (!url || !key) stop("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (production values).");
if (!password || password.length < 12) stop("Set DEMO_PASSWORD (12 characters or more).");

const sb = createClient(url, key, { auth: { persistSession: false } });
const must = (res, what) => {
  if (res.error) stop(`${what}: ${res.error.message}`);
  return res.data;
};

const DAY = 86_400_000;
const now = Date.now();
const iso = (d) => new Date(d).toISOString();
const date = (d) => new Date(d).toISOString().slice(0, 10);
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (list) => list[Math.floor(rnd() * list.length)];

async function main() {
  const existing = must(await sb.from("agencies").select("id").eq("slug", slug).maybeSingle(), "check");
  if (existing) stop(`An agency with the slug "${slug}" already exists. Nothing was changed.`);

  console.log(`Creating "${name}" (${slug}) on ${new URL(url).host}…`);
  const user = async (email, fullName) => {
    const res = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, locale: "fr" } });
    if (res.error) stop(`user ${email}: ${res.error.message}`);
    return res.data.user.id;
  };
  const adminId = await user(adminEmail, "Yassine Bennani (démo)");
  const staffId = await user(staffEmail, "Salma Idrissi (démo)");

  const agencyId = must(await sb.rpc("create_agency_for_user", { p_user: adminId, p_name: name, p_slug: slug }), "agency");
  const plan = must(await sb.from("plans").select("id").eq("code", "pro").maybeSingle(), "plan");
  must(
    await sb
      .from("agencies")
      .update({
        city: "Casablanca",
        phone: "+212522000000",
        address: "12 boulevard d'Anfa, Casablanca",
        brand_color: "#0F4C81",
        plan_id: plan?.id ?? null,
        subscription_status: "active",
        current_period_end: iso(now + 3650 * DAY),
        inspection_enabled: true,
      })
      .eq("id", agencyId),
    "agency details",
  );
  must(await sb.from("agency_members").insert({ agency_id: agencyId, user_id: staffId, role: "staff" }), "staff");

  const CARS = [
    ["Dacia Logan", "economy", "diesel", "manuelle", 250],
    ["Dacia Sandero", "economy", "diesel", "manuelle", 280],
    ["Renault Clio 5", "compact", "essence", "manuelle", 320],
    ["Peugeot 208", "compact", "diesel", "automatique", 380],
    ["Hyundai Accent", "compact", "essence", "automatique", 350],
    ["Volkswagen Polo", "compact", "diesel", "manuelle", 340],
    ["Hyundai Tucson", "suv", "diesel", "automatique", 650],
    ["Dacia Duster", "suv", "diesel", "manuelle", 450],
  ];
  const cars = must(
    await sb
      .from("vehicles")
      .insert(
        CARS.map(([brand_model, category, fuel, gearbox, daily_rate], i) => {
          const km = 25000 + i * 11000;
          return {
            agency_id: agencyId,
            plate: `${10000 + i * 1111}-${"ABDH"[i % 4]}-${(i % 6) + 1}`,
            brand_model,
            category,
            fuel,
            gearbox,
            daily_rate,
            current_km: km,
            oil_last_km: km - (i === 1 ? 9300 : 3000),
            oil_last_date: date(now - (30 + i * 7) * DAY),
            oil_next_km: km - (i === 1 ? 9300 : 3000) + 10000,
            insurance_expires_on: date(now + (i === 2 ? 12 : 120 + i * 20) * DAY),
            technical_visit_expires_on: date(now + (150 + i * 15) * DAY),
          };
        }),
      )
      .select("id, daily_rate, current_km"),
    "cars",
  );

  const FIRST = ["Karim", "Nadia", "Omar", "Salma", "Youssef", "Imane", "Hamza", "Sara", "Mehdi", "Fatima", "Anas", "Kenza", "Reda", "Hiba", "Amine"];
  const LAST = ["Alaoui", "Bennis", "Chraibi", "El Fassi", "Tazi", "Berrada", "Lahlou", "Naciri", "Kettani", "Squalli"];
  const clients = must(
    await sb
      .from("clients")
      .insert(
        FIRST.map((f, i) => ({
          agency_id: agencyId,
          full_name: `${f} ${pick(LAST)}`,
          phone: `+2126${String(10000000 + i * 1234567).slice(0, 8)}`,
          id_type: "cin",
          id_number: `DM${100000 + i * 7919}`,
          license_number: `P-${200000 + i * 313}`,
          address: "Casablanca",
        })),
      )
      .select("id"),
    "clients",
  );

  // Reservations: returned in the past 90 days, 3 on rental, 4 upcoming
  let n = 0;
  const book = async (car, startDay, days, status, paidShare) => {
    const client = clients[n++ % clients.length];
    const start = now + startDay * DAY;
    const end = start + days * DAY;
    const total = days * Number(car.daily_rate);
    const row = must(
      await sb
        .from("reservations")
        .insert({
          agency_id: agencyId,
          vehicle_id: car.id,
          client_id: client.id,
          start_at: iso(start),
          end_at: iso(end),
          daily_price: car.daily_rate,
          status,
          signed_at: status === "reserved" ? null : iso(start),
          actual_return_at: status === "returned" ? iso(end) : null,
          km_out: status === "reserved" ? null : car.current_km - 900,
          km_in: status === "returned" ? car.current_km - 400 : null,
          fuel_out: status === "reserved" ? null : 4,
          deposit_taken: status !== "reserved",
          deposit_amount: 3000,
        })
        .select("id")
        .single(),
      "reservation",
    );
    const paid = Math.round(total * paidShare);
    if (paid > 0) must(await sb.from("reservation_payments").insert({ agency_id: agencyId, reservation_id: row.id, amount: paid, method: pick(["cash", "card", "transfer"]), kind: "advance", paid_at: iso(start) }), "payment");
  };
  for (let k = 0; k < 18; k++) {
    const car = cars[k % cars.length];
    const startDay = -90 + k * 4.6;
    await book(car, startDay, 2 + (k % 4), "returned", k % 7 === 3 ? 0.6 : 1);
  }
  await book(cars[0], -2, 5, "on_rental", 0.5);
  await book(cars[3], -1, 3, "on_rental", 1);
  await book(cars[6], -4, 6, "on_rental", 0.3);
  await book(cars[1], 1, 3, "reserved", 0.2);
  await book(cars[2], 2, 4, "reserved", 0);
  await book(cars[4], 6, 7, "reserved", 0.3);
  await book(cars[7], 15, 10, "reserved", 0.1);

  // Charges: 3 months
  const charges = [];
  for (let m = 0; m < 3; m++) {
    const d = (x) => date(now - (m * 30 + x) * DAY);
    charges.push(
      { agency_id: agencyId, date: d(2), category: "loyer", amount: 6000, note: "Loyer du local" },
      { agency_id: agencyId, date: d(3), category: "salaires", amount: 9000, note: "Salaires" },
      { agency_id: agencyId, date: d(8), category: "lavage", amount: 400, vehicle_id: cars[m].id },
      { agency_id: agencyId, date: d(12), category: "publicite", amount: 800, campaign_name: "Facebook" },
      { agency_id: agencyId, date: d(20), category: "carburant", amount: 600, vehicle_id: cars[m + 3].id },
    );
  }
  must(await sb.from("charges").insert(charges), "charges");

  // Achat et crédit for 4 cars
  must(
    await sb.from("vehicle_finance").insert([
      { agency_id: agencyId, vehicle_id: cars[0].id, purchase_date: date(now - 1500 * DAY), purchase_price: 140000, mode: "credit", down_payment: 30000, monthly_payment: 2800, months: 48, first_payment_on: date(now - 1470 * DAY), lender: "Wafasalaf" },
      { agency_id: agencyId, vehicle_id: cars[3].id, purchase_date: date(now - 400 * DAY), purchase_price: 175000, mode: "credit", down_payment: 40000, monthly_payment: 3500, months: 48, first_payment_on: date(now - 370 * DAY), lender: "Eqdom" },
      { agency_id: agencyId, vehicle_id: cars[6].id, purchase_date: date(now - 200 * DAY), purchase_price: 290000, mode: "credit", down_payment: 60000, monthly_payment: 5600, months: 48, first_payment_on: date(now - 170 * DAY), lender: "Salafin" },
      { agency_id: agencyId, vehicle_id: cars[5].id, purchase_date: date(now - 800 * DAY), purchase_price: 160000, mode: "cash", down_payment: 0 },
    ]),
    "finance",
  );

  console.log(`\n✔ Done. Log in with ${adminEmail} (admin) or ${staffEmail} (staff) and the DEMO_PASSWORD you chose.\n`);
}

main().catch((e) => stop(e instanceof Error ? e.message : String(e)));
