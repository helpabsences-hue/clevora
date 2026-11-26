import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { VehicleForm } from "../components/vehicle-form";
import { getVehicleUsage } from "../queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fleet");
  return { title: t("add") };
}

export default async function NewVehiclePage() {
  const { agency } = await requireRole(["admin"]);
  const t = await getTranslations("fleet");
  const usage = await getVehicleUsage(await createClient(), agency.id);
  return (
    <>
      <PageHeader title={t("add")} subtitle={t("addSubtitle")} />
      {usage.atLimit ? (
        <Alert variant="warning" className="flex-wrap items-center">
          <span className="flex-1">{t("limitReached", { max: usage.max ?? 0, plan: usage.planName ?? "" })}</span>
          <Link href="/billing" className="inline-flex min-h-11 items-center font-semibold underline">
            {t("upgrade")}
          </Link>
        </Alert>
      ) : (
        <VehicleForm
          defaults={{
            plate: "",
            brand_model: "",
            first_registration_date: "",
            insurance_expires_on: "",
            technical_visit_expires_on: "",
            oil_last_km: "",
            oil_last_date: "",
            oil_next_km: "",
          }}
        />
      )}
    </>
  );
}
