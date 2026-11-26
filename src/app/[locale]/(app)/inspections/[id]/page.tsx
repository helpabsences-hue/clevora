import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { newDamages } from "@/lib/inspections/model";
import { InspectionCard } from "../components/inspection-card";
import { ReportShare } from "../components/report-share";
import { getInspections } from "../queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inspection");
  return { title: t("title") };
}

/** One rental in the Inspection section: departure and return side by side, the result, AI. */
export default async function InspectionPage({ params }: PageProps<"/[locale]/inspections/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { agency } = await requireAgency();
  if (!agency.inspection.enabled) redirect({ href: "/inspections", locale: await getLocale() });
  const t = await getTranslations("inspection");
  const supabase = await createClient();
  const [{ data: r }, inspections] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, contract_number, status, start_at, end_at, actual_return_at, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)")
      .eq("agency_id", agency.id)
      .eq("id", id)
      .maybeSingle(),
    getInspections(supabase, agency.id, id),
  ]);
  if (!r || r.status === "cancelled") notFound();
  const fresh = inspections.departure && inspections.return ? newDamages(inspections.departure.damages, inspections.return.damages) : [];

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/inspections">
          <ArrowLeftIcon className="rtl:rotate-180" aria-hidden />
          {t("title")}
        </Link>
      </Button>
      <PageHeader
        title={r.vehicle ? <>{r.vehicle.brand_model} <Ltr>{r.vehicle.plate}</Ltr></> : t("title")}
        subtitle={
          <>
            {r.client?.full_name} · <Ltr>{formatDateTime(r.start_at)}</Ltr> → <Ltr>{formatDateTime(r.actual_return_at ?? r.end_at)}</Ltr>
          </>
        }
        action={
          <Button variant="outline" size="lg" asChild>
            <Link href={`/contracts/${id}`}>
              <FileTextIcon aria-hidden />
              {t("seeContract", { number: r.contract_number })}
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <InspectionCard reservationId={id} status={r.status} inspections={inspections} />
        {inspections.departure?.completedAt ? (
          <ReportShare
            id={id}
            filename={`etat-des-lieux-${r.contract_number.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`}
            clientPhone={r.client?.phone ?? null}
            message={t("report.message", {
              name: r.client?.full_name ?? "",
              agency: agency.name,
              car: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : "",
              number: r.contract_number,
              result: !inspections.return?.completedAt
                ? t("report.resultDeparture", { count: inspections.departure.damages.filter((d) => d.confirmed).length })
                : fresh.length
                  ? t("report.resultNew", { count: fresh.length, list: fresh.map((d) => t(`types.${d.type}`) + (d.view ? ` (${t(`views.${d.view}`)})` : "")).join(", ") })
                  : t("report.resultNone"),
            })}
          />
        ) : null}
      </div>
    </>
  );
}
