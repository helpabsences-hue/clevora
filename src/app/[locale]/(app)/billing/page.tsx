import { CarIcon, FileDownIcon, LandmarkIcon, SparklesIcon, UsersIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { getPaymentProvider } from "@/lib/billing/provider";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PlanPicker, type PlanCard } from "./components/plan-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

function Usage({ icon: Icon, label, used, max }: { icon: LucideIcon; label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {label}
        </span>
        <Ltr className="font-semibold">{max === null ? `${used} / ∞` : `${used} / ${max}`}</Ltr>
      </div>
      {max !== null ? (
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max}>
          <div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Abonnement (admins): plan, usage, choose a plan, pay, download invoices. */
export default async function BillingPage() {
  const { agency } = await requireRole(["admin"]);
  const t = await getTranslations("billing");
  const supabase = await createClient();
  const [{ data: a }, { data: plans }, { count: cars }, { count: users }, { data: quota }, { data: payments }] = await Promise.all([
    supabase.from("agencies").select("subscription_status, trial_ends_at, current_period_end, plan:plans(code, name, max_vehicles, max_users)").eq("id", agency.id).single(),
    supabase.from("plans").select("code, name, price_mad_month, price_mad_year, max_vehicles, max_users, ai_enabled, ai_monthly_questions").eq("active", true).order("price_mad_month"),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "active"),
    supabase.from("agency_members").select("user_id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "active"),
    supabase.rpc("ai_quota", { p_agency: agency.id }),
    supabase
      .from("subscription_payments")
      .select("id, created_at, period, amount, method, reference, status, invoice_number, paid_at, plan:plans(name)")
      .eq("agency_id", agency.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);
  const plan = a?.plan ?? null;
  const status = a?.subscription_status ?? "trial";
  const pendingPay = (payments ?? []).find((p) => p.status === "pending");
  const bank = getPaymentProvider().instructions();
  const cards: PlanCard[] = (plans ?? []).map((p) => ({
    code: p.code as PlanCard["code"],
    name: p.name,
    month: Number(p.price_mad_month),
    year: Number(p.price_mad_year),
    maxVehicles: p.max_vehicles,
    maxUsers: p.max_users,
    ai: p.ai_enabled,
    aiQuestions: p.ai_monthly_questions,
  }));
  const q = quota?.[0];
  const statusLine =
    status === "trial"
      ? a?.trial_ends_at
        ? t("status.trialUntil", { date: formatDate(a.trial_ends_at) })
        : t("status.trial")
      : status === "active"
        ? a?.current_period_end
          ? t("status.activeUntil", { date: formatDate(a.current_period_end) })
          : t("status.active")
        : t(`status.${status}`);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex flex-col gap-6">
        {pendingPay ? (
          <Card className="border-warning" data-testid="billing-pending">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LandmarkIcon className="size-5 text-warning" aria-hidden />
                {t("pendingTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p>
                {t("pendingBody", { plan: pendingPay.plan?.name ?? "" })} <strong><Ltr>{formatMoney(pendingPay.amount)}</Ltr></strong>
              </p>
              <dl className="grid gap-2 rounded-lg bg-muted/60 p-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t("reference")}</dt>
                  <dd className="text-lg font-bold" data-testid="billing-reference"><Ltr>{pendingPay.reference}</Ltr></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("beneficiary")}</dt>
                  <dd className="font-semibold">{bank.beneficiary}</dd>
                </div>
                {bank.bankName ? (
                  <div>
                    <dt className="text-muted-foreground">{t("bank")}</dt>
                    <dd className="font-semibold">{bank.bankName}</dd>
                  </div>
                ) : null}
                {bank.rib ? (
                  <div>
                    <dt className="text-muted-foreground">{t("rib")}</dt>
                    <dd className="font-semibold"><Ltr>{bank.rib}</Ltr></dd>
                  </div>
                ) : null}
                {bank.phone ? (
                  <div>
                    <dt className="text-muted-foreground">{t("phone")}</dt>
                    <dd className="font-semibold"><Ltr>{bank.phone}</Ltr></dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-sm text-muted-foreground">{t("pendingHint")}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t("currentPlan", { plan: plan?.name ?? "—" })}
              <Badge variant={status === "active" ? "success" : status === "trial" ? "info" : "warning"}>{t(`statusBadge.${status}`)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground" data-testid="billing-status">{statusLine}</p>
            {!agency.subscription.writable ? <Alert variant="warning">{t("readOnly")}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-3">
              <Usage icon={CarIcon} label={t("usage.cars")} used={cars ?? 0} max={plan?.max_vehicles ?? null} />
              <Usage icon={UsersIcon} label={t("usage.users")} used={users ?? 0} max={plan?.max_users ?? null} />
              <Usage icon={SparklesIcon} label={t("usage.ai")} used={q?.used ?? 0} max={q?.plan_allows ? (q.quota ?? null) : 0} />
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="plans-title" className="flex flex-col gap-3">
          <h2 id="plans-title" className="text-xl font-bold">{t("plansTitle")}</h2>
          <PlanPicker plans={cards} currentCode={plan?.code ?? null} active={status === "active"} />
          <p className="text-sm text-muted-foreground">{t("pricesTtc")}</p>
        </section>

        <section aria-labelledby="history-title" className="flex flex-col gap-3">
          <h2 id="history-title" className="text-xl font-bold">{t("historyTitle")}</h2>
          {(payments ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-muted-foreground">{t("historyEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="billing-history">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">
                      {p.plan?.name} · {p.period === "year" ? t("yearly") : t("monthly")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      <Ltr>{formatDate(p.paid_at ?? p.created_at)}</Ltr> · {t(`methods.${p.method}`)} · <Ltr>{p.invoice_number ?? p.reference}</Ltr>
                    </span>
                  </div>
                  <Ltr className="text-lg font-bold">{formatMoney(p.amount)}</Ltr>
                  <Badge variant={p.status === "paid" ? "success" : "warning"}>{t(`payStatus.${p.status}`)}</Badge>
                  {p.status === "paid" ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/invoices/${p.id}`} target="_blank" rel="noopener">
                        <FileDownIcon aria-hidden />
                        {t("invoice")}
                      </a>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
