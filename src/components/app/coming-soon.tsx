import { ConstructionIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import type { NavKey } from "@/components/app/shell/nav-config";

/** Temporary page for a section that is built in a later step. */
export async function ComingSoon({ section }: { section: NavKey | "newReservation" }) {
  const t = await getTranslations("nav");
  const tc = await getTranslations("comingSoon");
  return (
    <>
      <PageHeader title={t(section)} />
      <EmptyState icon={ConstructionIcon} title={tc("title")} description={tc("body")} />
    </>
  );
}
