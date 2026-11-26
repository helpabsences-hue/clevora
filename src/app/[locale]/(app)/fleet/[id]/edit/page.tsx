import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { VehicleForm } from "../../components/vehicle-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fleet");
  return { title: t("edit") };
}

export default async function EditVehiclePage({ params }: PageProps<"/[locale]/fleet/[id]/edit">) {
  const { id } = await params;
  const { agency } = await requireRole(["admin"]);
  const t = await getTranslations("fleet");
  const supabase = await createClient();
  const { data: v } = await supabase.from("vehicles").select("*").eq("agency_id", agency.id).eq("id", id).maybeSingle();
  if (!v) notFound();
  return (
    <>
      <PageHeader title={t("edit")} subtitle={`${v.brand_model} · ${v.plate}`} />
      <VehicleForm
        id={v.id}
        defaults={{
          plate: v.plate,
          brand_model: v.brand_model,
          category: v.category as "economy",
          fuel: v.fuel as "diesel",
          gearbox: v.gearbox as "manuelle",
          daily_rate: Number(v.daily_rate),
          current_km: v.current_km,
          first_registration_date: v.first_registration_date ?? "",
          insurance_expires_on: v.insurance_expires_on ?? "",
          technical_visit_expires_on: v.technical_visit_expires_on ?? "",
          oil_last_km: v.oil_last_km ?? "",
          oil_last_date: v.oil_last_date ?? "",
          oil_next_km: v.oil_next_km ?? "",
        }}
      />
    </>
  );
}
