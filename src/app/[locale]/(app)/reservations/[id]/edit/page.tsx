import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { requireAgency } from "@/lib/auth/session";
import { isoToCasablanca } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ReservationWizard } from "../../components/reservation-wizard";
import { getBookingSettings, getReservation } from "../../queries";
import { EMPTY_DRIVER, type DriverInput, type ReservationInput } from "../../schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reservations");
  return { title: t("editTitle") };
}

type ClientRow = Record<string, string | null> | null;
function toDriver(c: ClientRow): DriverInput & { phone: string } {
  if (!c) return { ...EMPTY_DRIVER };
  const v = (k: string) => (c[k] ?? "") as string;
  return {
    id_type: (v("id_type") || "cin") as "cin" | "passport",
    id_number: v("id_number"),
    full_name: v("full_name"),
    phone: v("phone"),
    nationality: v("nationality"),
    address: v("address"),
    birth_date: v("birth_date"),
    birth_place: v("birth_place"),
    id_expires_on: v("id_expires_on"),
    license_number: v("license_number"),
    license_issued_on: v("license_issued_on"),
    license_issued_place: v("license_issued_place"),
  };
}

export default async function EditReservationPage({ params, searchParams }: PageProps<"/[locale]/reservations/[id]/edit">) {
  const { id } = await params;
  const step = Number((await searchParams).step ?? 0) || 0;
  const { agency } = await requireAgency();
  const t = await getTranslations("reservations");
  const supabase = await createClient();
  const [data, settings] = await Promise.all([getReservation(supabase, agency.id, id), getBookingSettings(supabase, agency.id)]);
  if (!data) notFound();
  const r = data.reservation;
  if (r.status !== "reserved") {
    return (
      <>
        <PageHeader title={t("editTitle")} />
        <Alert variant="warning">{t("notEditable")}</Alert>
      </>
    );
  }
  const start = isoToCasablanca(r.start_at);
  const end = isoToCasablanca(r.end_at);
  const deposit = data.payments.find((p) => p.kind === "deposit");
  const initial: ReservationInput = {
    contract_number: r.contract_number,
    start_date: start.date,
    start_time: start.time,
    end_date: end.date,
    end_time: end.time,
    vehicle_id: r.vehicle?.id ?? "",
    car_later: !r.vehicle,
    driver1: toDriver(r.client as ClientRow),
    has_driver2: Boolean(r.driver2),
    driver2: r.driver2 ? toDriver(r.driver2 as ClientRow) : undefined,
    daily_price: Number(r.daily_price),
    delivery: r.delivery,
    delivery_place: r.delivery_place ?? "",
    return_place: r.return_place ?? "",
    delivery_fee: Number(r.delivery_fee),
    advance_amount: 0, // payments are managed on the reservation page
    advance_method: "cash",
    franchise: Number(r.franchise),
    deposit_taken: r.deposit_taken,
    deposit_amount: Number(r.deposit_amount),
    deposit_method: (deposit?.method as "cash") ?? "cheque",
    km_out: r.km_out,
    fuel_out: r.fuel_out,
    equipment: r.equipment,
    documents_given: r.documents_given,
    notes: r.notes ?? "",
  };
  const car = r.vehicle
    ? { id: r.vehicle.id, plate: r.vehicle.plate, brand_model: r.vehicle.brand_model, category: r.vehicle.category, fuel: r.vehicle.fuel, gearbox: r.vehicle.gearbox, daily_rate: Number(r.vehicle.daily_rate), current_km: r.vehicle.current_km }
    : null;
  return (
    <>
      <PageHeader title={`${t("editTitle")} · ${r.contract_number}`} />
      <ReservationWizard initialStep={step} reservationId={r.id} initial={initial} initialCar={car} contractPlaceholder={r.contract_number} settings={settings} />
    </>
  );
}
