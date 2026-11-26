import { AlertTriangleIcon, BuildingIcon, CarIcon, ClockIcon, CreditCardIcon, LandmarkIcon, LockIcon, SparklesIcon, TrendingUpIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ProgressBar } from "@/components/app/progress-bar";
import { StatTile } from "@/components/app/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formatUsage, usageLines } from "@/lib/usage";
import { MonthBars } from "./components/month-bars";
import { PaymentActions } from "./components/payment-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("title") };
}

type Stats = {
  agencies: number;
  trial: number;
  active: number;
  past_due: number;
  suspended: number;
  cancelled: number;
  read_only: number;
  new_this_month: number;
  mrr: number;
  collected_this_month: number;
  vehicles: number;
  users: number;
  active_users_30d: number;
  reservations_30d: number;
  reservations_total: number;
  ai_questions_month: number;
  pending_payments: number;
  by_month: Array<{ month: string; new_agencies: number; collected: number }>;
  trials_ending: Array<{ id: string; name: string; city: string | null; ends: string }>;
};

/** Parcolia owner dashboard: the business at a glance. (The layout checked access.) */
export default async function PlatformDashboard() {
  const t = await getTranslations("platform");
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: statsJson }, { data: pending }, { data: usageRows }] = await Promise.all([
    supabase.rpc("platform_stats"),
    supabase
      .from("subscription_payments")
      .select("id, created_at, period, amount, method, reference, plan:plans(name), agency:agencies(id, name)")
      .eq("status", "pending")
      .order("created_at"),
    supabase.rpc("platform_usage"),
  ]);
  const s = statsJson as unknown as Stats;
  const u = usageRows?.[0];
  const usage = u ? usageLines({ database_bytes: Number(u.database_bytes), storage_bytes: Number(u.storage_bytes), active_users_30d: u.active_users_30d }) : [];
  const monthLabel = (m: string) => format.dateTime(new Date(`${m}-15T12:00:00Z`), { month: "short", year: "2-digit" });
  const nf = (n: number) => format.number(n);

  return (
    <>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />

      <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="platform-kpis">
        <li><StatTile label={t("dashboard.mrr")} value={<Ltr>{formatMoney(Number(s.mrr))}</Ltr>} hint={t("dashboard.mrrHint")} icon={TrendingUpIcon} tone="success" testId="platform-mrr" /></li>
        <li><StatTile label={t("dashboard.collected")} value={<Ltr>{formatMoney(Number(s.collected_this_month))}</Ltr>} icon={LandmarkIcon} tone="success" /></li>
        <li><StatTile label={t("tiles.agencies")} value={s.agencies} hint={t("dashboard.newThisMonth", { count: s.new_this_month })} icon={BuildingIcon} href="/platform/agencies" testId="platform-agencies" /></li>
        <li><StatTile label={t("tiles.paying")} value={s.active} icon={CreditCardIcon} tone="success" href="/platform/agencies?status=active" /></li>
        <li><StatTile label={t("tiles.trial")} value={s.trial} icon={ClockIcon} tone="info" href="/platform/agencies?status=trial" /></li>
        <li><StatTile label={t("tiles.readOnly")} value={s.read_only} hint={t("dashboard.readOnlyHint")} icon={LockIcon} tone={s.read_only ? "warning" : "neutral"} href="/platform/agencies?status=read_only" /></li>
        <li><StatTile label={t("dashboard.users")} value={nf(s.users)} hint={t("dashboard.activeUsers", { count: s.active_users_30d })} icon={UsersIcon} href="/platform/users" /></li>
        <li><StatTile label={t("dashboard.cars")} value={nf(s.vehicles)} hint={t("dashboard.reservations30", { count: s.reservations_30d })} icon={CarIcon} /></li>
      </ul>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <MonthBars title={t("dashboard.collectedByMonth")} data={s.by_month.map((m) => ({ label: monthLabel(m.month), value: Number(m.collected) }))} format={(n) => formatMoney(n)} testId="chart-collected" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <MonthBars title={t("dashboard.newByMonth")} data={s.by_month.map((m) => ({ label: monthLabel(m.month), value: m.new_agencies }))} format={nf} testId="chart-signups" />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("pendingTitle")}
              {(pending ?? []).length ? <span className="rounded-full bg-warning-soft px-2 text-sm text-warning">{(pending ?? []).length}</span> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(pending ?? []).length === 0 ? (
              <p className="text-muted-foreground">{t("pendingNone")}</p>
            ) : (
              <ul className="flex flex-col divide-y" data-testid="platform-pending">
                {(pending ?? []).map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={`/platform/agencies/${p.agency?.id}`} className="font-semibold hover:underline">
                        {p.agency?.name}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {p.plan?.name} ({p.period === "year" ? t("year") : t("month")}) · {t(`methods.${p.method}`)} · <Ltr>{p.reference}</Ltr>
                      </span>
                    </div>
                    <Ltr className="font-bold">{formatMoney(p.amount)}</Ltr>
                    <PaymentActions id={p.id} label={`${p.agency?.name ?? ""} · ${p.reference} · ${formatMoney(p.amount)}`} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("dashboard.trialsEnding")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.trials_ending.length === 0 ? (
              <p className="text-muted-foreground">{t("dashboard.trialsEndingNone")}</p>
            ) : (
              <ul className="flex flex-col divide-y" data-testid="platform-trials">
                {s.trials_ending.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2 first:pt-0">
                    <Link href={`/platform/agencies/${a.id}`} className="min-w-0 truncate font-medium hover:underline">
                      {a.name} <span className="text-sm font-normal text-muted-foreground">{a.city}</span>
                    </Link>
                    <Ltr className={new Date(a.ends) < new Date() ? "text-sm font-semibold text-destructive" : "text-sm text-muted-foreground"}>{formatDate(a.ends)}</Ltr>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {usage.length ? (
          <Card data-testid="platform-usage">
            <CardHeader>
              <CardTitle>{t("supabaseUsage.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t("supabaseUsage.hint")}</p>
              <ul className="flex flex-col gap-4">
                {usage.map((l) => (
                  <li key={l.metric} className="flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{t(`supabaseUsage.${l.metric}`)}</span>
                      <Ltr className={l.level === 95 ? "font-bold text-destructive" : l.level === 80 ? "font-bold text-warning" : "text-muted-foreground"}>{`${formatUsage(l.metric, l.used)} / ${formatUsage(l.metric, l.limit)} · ${l.pct} %`}</Ltr>
                    </span>
                    <ProgressBar value={l.pct} label={t(`supabaseUsage.${l.metric}`)} tone={l.level ? "warning" : "primary"} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("dashboard.activity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {[
                [t("dashboard.reservationsTotal"), nf(s.reservations_total)],
                [t("dashboard.reservations30Short"), nf(s.reservations_30d)],
                [t("dashboard.aiQuestions"), nf(s.ai_questions_month)],
                [t("dashboard.lateOrSuspended"), nf(Number(s.past_due) + Number(s.suspended))],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/60 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-bold"><Ltr>{value}</Ltr></dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
