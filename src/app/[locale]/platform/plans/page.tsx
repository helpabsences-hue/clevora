import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { PlanForm } from "../components/plan-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.plans");
  return { title: t("title") };
}

/** Prices and limits of each plan (shown on the public site and the billing page). */
export default async function PlatformPlansPage() {
  const t = await getTranslations("platform.plans");
  const supabase = await createClient();
  const [{ data: plans }, { data: overview }] = await Promise.all([
    supabase.from("plans").select("id, code, name, price_mad_month, price_mad_year, max_vehicles, max_users, ai_enabled, ai_monthly_questions, active").order("price_mad_month"),
    supabase.rpc("platform_overview"),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 lg:grid-cols-3">
        {(plans ?? []).map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {p.name}
                <span className="text-sm font-normal text-muted-foreground">{t("agenciesOn", { count: (overview ?? []).filter((a) => a.plan_code === p.code).length })}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlanForm
                plan={{
                  id: p.id,
                  code: p.code,
                  name: p.name,
                  price_mad_month: Number(p.price_mad_month),
                  price_mad_year: Number(p.price_mad_year),
                  max_vehicles: p.max_vehicles,
                  max_users: p.max_users,
                  ai_enabled: p.ai_enabled,
                  ai_monthly_questions: p.ai_monthly_questions,
                  active: p.active,
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
