import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../../components/client-form";
import { getClient } from "../client-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return { title: t("edit") };
}

export default async function EditClientPage({ params }: PageProps<"/[locale]/clients/[id]/edit">) {
  const { id } = await params;
  const { agency } = await requireAgency();
  const t = await getTranslations("clients");
  const { client, form } = await getClient(await createClient(), agency.id, id);
  return (
    <>
      <PageHeader title={t("edit")} subtitle={client.full_name} />
      <ClientForm id={id} defaults={form} />
    </>
  );
}
