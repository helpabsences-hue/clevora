import { LockIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Chat } from "./components/chat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("assistant") };
}

const STAFF_SUGGESTIONS = ["whoHadCar", "returns", "free", "unpaid", "carHistory", "oil"] as const;
const ADMIN_SUGGESTIONS = ["revenue", "unpaid", "whoHadCar", "returns", "free", "carHistory"] as const;

/** Assistant IA: questions in plain words, answered from the agency's own data. */
export default async function AssistantPage() {
  const { agency } = await requireAgency();
  const isAdmin = agency.role === "admin";
  const t = await getTranslations("assistant");
  const supabase = await createClient();
  const { data: quotaRows } = await supabase.rpc("ai_quota", { p_agency: agency.id });
  const quota = quotaRows?.[0];
  const configured = process.env.AI_PROVIDER === "mock" || Boolean(process.env.ANTHROPIC_API_KEY);
  const remaining = quota?.quota === null || quota?.quota === undefined ? null : Math.max(0, quota.quota - quota.used);

  if (!quota?.plan_allows) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          icon={LockIcon}
          title={t("notInPlan")}
          description={isAdmin ? t("notInPlanAdmin") : t("notInPlanStaff")}
          action={isAdmin ? <Button size="lg" asChild><Link href="/billing">{t("seePlans")}</Link></Button> : undefined}
        />
      </>
    );
  }
  if (!quota.enabled) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={SparklesIcon} title={t("disabled")} description={isAdmin ? t("disabledAdmin") : t("disabledStaff")} />
      </>
    );
  }

  const suggestions = (isAdmin ? ADMIN_SUGGESTIONS : STAFF_SUGGESTIONS).map((k) => t(`suggestions.${k}`));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {/* Phone: room under the content for the fixed question bar above the bottom nav */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-40 md:pb-0">
        {!configured ? <Alert variant="warning">{t("notConfigured")}</Alert> : null}
        {remaining === 0 ? <Alert variant="warning">{t("quotaReached")}</Alert> : null}
        <Chat suggestions={suggestions} remaining={remaining} />
        <details className="text-sm text-muted-foreground">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium">
            <LockIcon className="size-4" aria-hidden />
            {t("privacyTitle")}
          </summary>
          <p className="mt-1">{isAdmin ? t("privacyAdmin") : t("privacyStaff")}</p>
        </details>
      </div>
    </>
  );
}
