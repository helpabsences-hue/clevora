import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { requireAgency } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ReservationWizard } from "../components/reservation-wizard";
import { getBookingSettings } from "../queries";
import { EMPTY_DRIVER, type ReservationInput } from "../schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("newReservation") };
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** New reservation. ?vehicle=…&date=yyyy-mm-dd prefill it (from the planning), ?client=… the driver. */
export default async function NewReservationPage({ searchParams }: PageProps<"/[locale]/reservations/new">) {
  const { agency } = await requireAgency();
  const t = await getTranslations("reservations");
  const sp = await searchParams;
  const supabase = await createClient();
  const [settings, { data: placeholder }] = await Promise.all([
    getBookingSettings(supabase, agency.id),
    supabase.rpc("preview_contract_number", { p_agency: agency.id }),
  ]);

  // Smart defaults: leave at the next full hour (or 09:00 on a chosen day), back the next day
  const now = new Date();
  const today = dayKey(now);
  const chosenDay = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date >= today ? sp.date : null;
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", hour: "2-digit", hourCycle: "h23" }).format(now);
  const nextHour = Math.min(23, Number(hour) + 1);
  const startDate = chosenDay ?? (Number(hour) >= 22 ? addDays(today, 1) : today);
  const startTime = chosenDay ? "09:00" : Number(hour) >= 22 ? "09:00" : `${String(nextHour).padStart(2, "0")}:00`;

  let initialCar = null;
  if (typeof sp.vehicle === "string" && /^[0-9a-f-]{36}$/.test(sp.vehicle)) {
    const { data } = await supabase
      .from("vehicles")
      .select("id, plate, brand_model, category, fuel, gearbox, daily_rate, current_km")
      .eq("agency_id", agency.id)
      .eq("id", sp.vehicle)
      .maybeSingle();
    if (data) initialCar = { ...data, daily_rate: Number(data.daily_rate) };
  }

  // From a client's page: ?client=… fills the first driver.
  let driver1 = { ...EMPTY_DRIVER };
  if (typeof sp.client === "string" && /^[0-9a-f-]{36}$/.test(sp.client)) {
    const { data: c } = await supabase
      .from("clients")
      .select("id_type, id_number, full_name, phone, nationality, address, birth_date, birth_place, id_expires_on, license_number, license_issued_on, license_issued_place")
      .eq("agency_id", agency.id)
      .eq("id", sp.client)
      .is("anonymized_at", null)
      .maybeSingle();
    if (c) {
      driver1 = {
        id_type: c.id_type as "cin" | "passport",
        id_number: c.id_number,
        full_name: c.full_name,
        phone: c.phone ?? "",
        nationality: c.nationality ?? "",
        address: c.address ?? "",
        birth_date: c.birth_date ?? "",
        birth_place: c.birth_place ?? "",
        id_expires_on: c.id_expires_on ?? "",
        license_number: c.license_number ?? "",
        license_issued_on: c.license_issued_on ?? "",
        license_issued_place: c.license_issued_place ?? "",
      };
    }
  }

  const initial: ReservationInput = {
    contract_number: "",
    start_date: startDate,
    start_time: startTime,
    end_date: addDays(startDate, 1),
    end_time: startTime,
    vehicle_id: initialCar?.id ?? "",
    car_later: false,
    driver1,
    has_driver2: false,
    daily_price: initialCar?.daily_rate ?? 0,
    delivery: false,
    delivery_place: "",
    return_place: "",
    delivery_fee: 0,
    advance_amount: 0,
    advance_method: "cash",
    franchise: settings.defaultFranchise,
    deposit_taken: settings.defaultDeposit > 0,
    deposit_amount: settings.defaultDeposit,
    deposit_method: "cheque",
    km_out: initialCar?.current_km ?? null,
    fuel_out: 4,
    equipment: [...settings.equipmentItems.filter((i) => !/b[ée]b[ée]/i.test(i))],
    documents_given: [...settings.documentItems],
    notes: "",
  };

  return (
    <>
      <PageHeader title={t("new")} />
      <ReservationWizard initial={initial} initialCar={initialCar} contractPlaceholder={(placeholder as string | null) ?? "C-1"} settings={settings} />
    </>
  );
}
