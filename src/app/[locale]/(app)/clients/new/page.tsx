import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { requireAgency } from "@/lib/auth/session";
import { ClientForm } from "../components/client-form";
import { EMPTY_CLIENT } from "../schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return { title: t("add") };
}

export default async function NewClientPage() {
  await requireAgency();
  const t = await getTranslations("clients");
  return (
    <>
      <PageHeader title={t("add")} subtitle={t("addSubtitle")} />
      <ClientForm defaults={EMPTY_CLIENT} />
    </>
  );
}
