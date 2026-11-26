import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { InspectionCapture } from "../../components/inspection-capture";
import { carryOverDamages, getInspections, modeFor } from "../../queries";
import { KINDS, type Kind } from "../../schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inspection");
  return { title: t("title") };
}

/** Inspection départ / retour of one rental: photos per view (or one video) + damage marks. */
export default async function InspectionCapturePage({ params, searchParams }: PageProps<"/[locale]/inspections/[id]/[kind]">) {
  const { id, kind } = await params;
  // Came from Démarrer / Retour: go back there once the inspection is finished.
  const then = (await searchParams).then;
  const after = then === "start" || then === "return" ? `/reservations/${id}?do=${then}` : `/inspections/${id}`;
  if (!/^[0-9a-f-]{36}$/.test(id) || !KINDS.includes(kind as Kind)) notFound();
  const { agency } = await requireAgency();
  if (!agency.inspection.enabled) redirect({ href: "/inspections", locale: await getLocale() });
  const t = await getTranslations("inspection");
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reservations")
    .select("id, contract_number, status, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name)")
    .eq("agency_id", agency.id)
    .eq("id", id)
    .maybeSingle();
  if (!r || r.status === "cancelled") notFound();
  const all = await getInspections(supabase, agency.id, id);
  let inspection = all[kind as Kind];
  if (!inspection) {
    // First visit: open the inspection (staff can do it; RLS checks the agency).
    // Built from the insert itself: a second identical read in the same render
    // would be answered from Next's request memo (still empty).
    const mode = all.departure && kind === "return" ? all.departure.mode : await modeFor(supabase, agency.id, id, kind as Kind, agency.inspection.mode);
    const { data: created } = await supabase.from("inspections").insert({ agency_id: agency.id, reservation_id: id, kind, mode }).select("id").single();
    if (!created) notFound();
    // Departure: start from the damages the car already had (its last finished inspection)
    const damages = kind === "departure" ? await carryOverDamages(supabase, agency.id, id, created.id, (k) => t("carried", { number: k.contractNumber, date: formatDate(k.completedAt) })) : [];
    inspection = { id: created.id, kind: kind as Kind, mode, videoUrl: null, completedAt: null, notes: null, aiStatus: "none", aiCheckedAt: null, photos: [], damages };
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href={`/inspections/${id}`}>
          <ArrowLeftIcon className="rtl:rotate-180" aria-hidden />
          {t("backToInspection")}
        </Link>
      </Button>
      <PageHeader
        title={kind === "departure" ? t("titleDeparture") : t("titleReturn")}
        subtitle={
          <>
            {r.vehicle ? (
              <>
                {r.vehicle.brand_model} <Ltr>{r.vehicle.plate}</Ltr> ·{" "}
              </>
            ) : null}
            {r.client?.full_name} · <Ltr>{r.contract_number}</Ltr>
          </>
        }
      />
      <InspectionCapture agencyId={agency.id} after={after} kind={kind as Kind} inspection={inspection} reference={kind === "return" ? (all.departure?.damages ?? []) : []} />
    </>
  );
}
