import { ArrowLeftIcon, FileDownIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatDate, formatMoney, isoToCasablanca } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { PlatformAgencyForm } from "../../components/agency-form";
import { PaymentActions } from "../../components/payment-actions";
import { AgencyQuickActions } from "../../components/agency-quick-actions";
import { MonthBars } from "../../components/month-bars";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("title") };
}

/** Parcolia: one agency — subscription, members, payments. (The layout checked platform access.) */
export default async function PlatformAgencyPage({ params }: PageProps<"/[locale]/platform/agencies/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("platform");
  const tr = await getTranslations("roles");
  const supabase = await createClient();
  const [{ data: overview }, { data: a }, { data: payments }, { data: activityJson }] = await Promise.all([
    supabase.rpc("platform_overview"),
    supabase.from("agencies").select("name, slug, city, phone, email, created_at, subscription_status, trial_ends_at, current_period_end, plan:plans(code)").eq("id", id).maybeSingle(),
    supabase.from("subscription_payments").select("id, created_at, period, amount, method, reference, status, invoice_number, paid_at, plan:plans(name)").eq("agency_id", id).order("created_at", { ascending: false }),
    supabase.rpc("platform_agency_activity", { p_agency: id }),
  ]);
  const activity = activityJson as unknown as {
    clients: number;
    reservations_total: number;
    contracts_month: number;
    ai_questions_month: number;
    last_activity: string | null;
    last_login: string | null;
    by_month: Array<{ month: string; reservations: number }>;
  } | null;
  if (!a) notFound();
  const o = (overview ?? []).find((x) => x.id === id);
  // RLS lets platform admins read every membership and profile.
  const { data: members } = await supabase
    .from("agency_members")
    .select("role, status, profile:profiles!agency_members_user_id_fkey(full_name, email, phone)")
    .eq("agency_id", id)
    .order("created_at");
  const day = (iso: string | null) => (iso ? isoToCasablanca(iso).date : "");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/platform/agencies">
          <ArrowLeftIcon className="rtl:rotate-180" aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={a.name}
        subtitle={<>{a.city} · <Ltr>/{a.slug}</Ltr> · {t("since", { date: formatDate(a.created_at) })}</>}
        action={<AgencyQuickActions id={id} name={a.name} status={a.subscription_status} />}
      />
      {activity ? (
        <Card className="mb-6" data-testid="agency-activity">
          <CardHeader>
            <CardTitle>{t("activityTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                [t("activity.clients"), activity.clients],
                [t("activity.reservations"), activity.reservations_total],
                [t("activity.contractsMonth"), activity.contracts_month],
                [t("activity.ai"), activity.ai_questions_month],
                [t("activity.lastLogin"), activity.last_login ? formatDate(activity.last_login) : "—"],
                [t("activity.lastActivity"), activity.last_activity ? formatDate(activity.last_activity) : "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-muted/60 p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-bold"><Ltr>{value}</Ltr></dd>
                </div>
              ))}
            </dl>
            <MonthBars title={t("activity.byMonth")} data={activity.by_month.map((m) => ({ label: m.month.slice(5) + "/" + m.month.slice(2, 4), value: m.reservations }))} format={(n) => String(n)} />
          </CardContent>
          <p className="px-6 pb-4 text-xs text-muted-foreground">{t("activity.privacy")}</p>
        </Card>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("subscription")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PlatformAgencyForm
              values={{
                id,
                plan: (a.plan?.code ?? "pro") as "essentiel" | "pro" | "illimite",
                status: a.subscription_status as "trial",
                trial_ends_on: day(a.trial_ends_at),
                period_ends_on: day(a.current_period_end),
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("usage")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                [t("cars"), o?.vehicles ?? 0],
                [t("members"), o?.members ?? 0],
                [t("reservations30"), o?.reservations_30d ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-muted/60 p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-bold"><Ltr>{value}</Ltr></dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-1 text-sm">
              {a.phone ? <span><Ltr>{formatPhone(a.phone)}</Ltr></span> : null}
              {a.email ? <span><Ltr>{a.email}</Ltr></span> : null}
            </div>
            <h3 className="font-semibold">{t("membersTitle")}</h3>
            <ul className="flex flex-col divide-y text-sm">
              {(members ?? []).map((m, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-medium">{m.profile?.full_name || "—"}</span>
                  <Ltr className="text-muted-foreground">{m.profile?.email}</Ltr>
                  <Badge variant={m.role === "admin" ? "info" : "neutral"}>{tr(m.role)}</Badge>
                  {m.status !== "active" ? <Badge variant="warning">{m.status}</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="payments-title" className="mt-6">
        <h2 id="payments-title" className="mb-3 text-xl font-bold">{t("paymentsTitle")}</h2>
        {(payments ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-muted-foreground">{t("paymentsNone")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(payments ?? []).map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{p.plan?.name} ({p.period === "year" ? t("year") : t("month")})</span>
                  <span className="text-sm text-muted-foreground">
                    <Ltr>{formatDate(p.paid_at ?? p.created_at)}</Ltr> · {t(`methods.${p.method}`)} · <Ltr>{p.invoice_number ?? p.reference}</Ltr>
                  </span>
                </div>
                <Ltr className="text-lg font-bold">{formatMoney(p.amount)}</Ltr>
                <Badge variant={p.status === "paid" ? "success" : p.status === "pending" ? "warning" : "neutral"}>{t(`payStatus.${p.status}`)}</Badge>
                {p.status === "pending" ? <PaymentActions id={p.id} label={`${a.name} · ${p.reference} · ${formatMoney(p.amount)}`} /> : null}
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
    </>
  );
}
