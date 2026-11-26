import type * as React from "react";
import { ArrowLeftIcon, CalendarCheckIcon, DropletIcon, ShieldCheckIcon, WalletIcon, WrenchIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Arrow, Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { AGE_WARNING_YEARS, vehicleAgeYears } from "@/lib/fleet/status";
import { dayKey, daysBetween, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { monthBounds, revenueBetween } from "@/lib/revenue";
import { createClient } from "@/lib/supabase/server";
import { AdminVehicleMenu } from "../components/admin-vehicle-menu";
import { VehicleStatusBadge } from "../components/status-badge";
import { VehicleActions } from "../components/vehicle-actions";
import { getProfitability } from "@/lib/fleet/finance-query";
import { FinanceCard } from "../components/finance-card";
import { getKnownDamages } from "../../inspections/queries";
import { KnownDamagesCard } from "../components/known-damages-card";
import { getVehicle } from "../queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("fleet") };
}

export default async function VehicleDetailPage({ params }: PageProps<"/[locale]/fleet/[id]">) {
  const { id } = await params;
  const { agency } = await requireAgency();
  const isAdmin = agency.role === "admin";
  const t = await getTranslations("fleet");
  const supabase = await createClient();
  const data = await getVehicle(supabase, agency.id, id, isAdmin);
  if (!data) notFound();
  const { vehicle: v, computed, maintenance, openMaintenance, upcoming, charges, monthReservations } = data;

  // Achat et crédit (admins only: the function refuses staff)
  const finance = isAdmin ? ((await getProfitability(supabase, agency.id)).find((p) => p.vehicle_id === v.id) ?? null) : null;
  // Inspection turned on: the car's damages as last seen
  const known = agency.inspection.enabled ? await getKnownDamages(supabase, agency.id, v.id) : null;
  const { data: alertCfg } = await supabase.from("agencies").select("alert_days_before, alert_km_before").eq("id", agency.id).single();
  const today = dayKey(new Date());
  const dateState = (d: string | null) => {
    if (!d) return { variant: "neutral" as const, label: t("detail.unknown") };
    const left = daysBetween(today, d);
    if (left < 0) return { variant: "danger" as const, label: t("detail.expired") };
    if (left <= (alertCfg?.alert_days_before ?? 30)) return { variant: "warning" as const, label: t("detail.inDays", { days: left }) };
    return { variant: "success" as const, label: t("detail.inDays", { days: left }) };
  };
  const kmLeft = v.oil_next_km === null ? null : v.oil_next_km - v.current_km;
  const oilVariant = kmLeft === null ? "neutral" : kmLeft <= 0 ? "danger" : kmLeft <= (alertCfg?.alert_km_before ?? 1500) ? "warning" : "success";
  const age = vehicleAgeYears(v.first_registration_date);
  const month = monthBounds();
  const revenue = monthReservations ? revenueBetween(monthReservations.map((r) => ({ ...r, daily_price: Number(r.daily_price), delivery_fee: Number(r.delivery_fee) })), month.from, month.to) : null;
  const chargesMonth = charges?.filter((c) => c.date >= month.from && c.date <= month.to).reduce((s, c) => s + Number(c.amount), 0) ?? null;
  const label = `${v.brand_model} · ${v.plate}`;

  const info: Array<[string, React.ReactNode]> = [
    [t("form.plate"), <Ltr key="p">{v.plate}</Ltr>],
    [t("columns.type"), `${t(`categories.${v.category}`)} · ${t(`fuels.${v.fuel}`)} · ${t(`gearboxes.${v.gearbox}`)}`],
    [t("form.dailyRate"), <Ltr key="r">{formatMoney(v.daily_rate)}</Ltr>],
    [t("form.currentKm"), <Ltr key="k">{v.current_km.toLocaleString("fr-FR").replace(/ /g, " ")} km</Ltr>],
    [t("form.firstRegistration"), v.first_registration_date ? <span key="f"><Ltr>{formatDate(v.first_registration_date)}</Ltr> · <Badge variant={age !== null && age >= AGE_WARNING_YEARS ? "warning" : "neutral"}>{t("age", { years: age ?? 0 })}</Badge></span> : "—"],
  ];

  return (
    <>
      <Link href="/fleet" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
        {t("title")}
      </Link>
      <PageHeader
        title={v.brand_model}
        subtitle={<Ltr>{v.plate}</Ltr>}
        action={
          <>
            <VehicleActions vehicleId={v.id} vehicleLabel={label} openMaintenanceId={openMaintenance?.id ?? null} sold={v.status === "sold"} />
            {isAdmin ? <AdminVehicleMenu vehicleId={v.id} sold={v.status === "sold"} /> : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <VehicleStatusBadge status={computed} />
      </div>

      {isAdmin ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("detail.revenueMonth")} value={<Ltr>{formatMoney(revenue ?? 0)}</Ltr>} icon={WalletIcon} tone="success" testId="vehicle-revenue" />
          <StatTile label={t("detail.chargesMonth")} value={<Ltr>{formatMoney(chargesMonth ?? 0)}</Ltr>} icon={WalletIcon} tone="warning" />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {agency.inspection.enabled ? <KnownDamagesCard known={known} /> : null}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.info")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {info.map(([k, val]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("detail.papers")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(
              [
                ["insurance", t("form.insuranceEnd"), v.insurance_expires_on, ShieldCheckIcon],
                ["visit", t("form.visitEnd"), v.technical_visit_expires_on, ShieldCheckIcon],
              ] as const
            ).map(([key, lbl, d, Icon]) => {
              const s = dateState(d);
              return (
                <div key={key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                    {lbl}
                  </span>
                  <span className="flex items-center gap-2">
                    {d ? <Ltr>{formatDate(d)}</Ltr> : null}
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </span>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <DropletIcon className="size-5 text-muted-foreground" aria-hidden />
                {t("detail.oil")}
              </span>
              <span className="flex items-center gap-2">
                {v.oil_next_km !== null ? <Ltr>{v.oil_next_km.toLocaleString("fr-FR").replace(/ /g, " ")} km</Ltr> : null}
                <Badge variant={oilVariant}>
                  {kmLeft === null ? t("detail.unknown") : kmLeft <= 0 ? t("detail.oilDue") : t("detail.kmLeft", { km: kmLeft.toLocaleString("fr-FR").replace(/ /g, " ") })}
                </Badge>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheckIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("detail.upcoming")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length ? (
              <ul className="flex flex-col divide-y">
                {upcoming.map((r) => (
                  <li key={r.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                    <span className="font-semibold">
                      <Ltr>{r.contract_number}</Ltr> · {r.client?.full_name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      <Ltr>{formatDateTime(r.start_at)}</Ltr><Arrow /><Ltr>{formatDateTime(r.end_at)}</Ltr>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("detail.noUpcoming")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WrenchIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("detail.maintenanceHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {maintenance.length ? (
              <ul className="flex flex-col divide-y" data-testid="maintenance-history">
                {maintenance.map((m) => (
                  <li key={m.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {t(`reasons.${m.reason}`)}
                      {m.ended_on === null && m.starts_on <= today ? <Badge variant="warning">{t("detail.inProgress")}</Badge> : null}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      <Ltr>{formatDate(m.starts_on)}</Ltr><Arrow /><Ltr>{m.ended_on ? formatDate(m.ended_on) : m.expected_end_on ? formatDate(m.expected_end_on) : "…"}</Ltr>
                      {m.note ? ` · ${m.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("detail.noMaintenance")}</p>
            )}
          </CardContent>
        </Card>

        {isAdmin && charges ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletIcon className="size-5 text-muted-foreground" aria-hidden />
                {t("detail.charges")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {charges.length ? (
                <ul className="flex flex-col divide-y">
                  {charges.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <span>
                        <Ltr>{formatDate(c.date)}</Ltr> · {t(`chargeCategories.${c.category}`)}
                        {c.note ? <span className="text-muted-foreground"> · {c.note}</span> : null}
                      </span>
                      <Ltr className="font-semibold">{formatMoney(c.amount)}</Ltr>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("detail.noCharges")}</p>
              )}
            </CardContent>
          </Card>
        ) : null}
        {isAdmin ? <FinanceCard vehicleId={v.id} label={label} row={finance} /> : null}
      </div>

      {v.status === "sold" ? null : (
        <div className="mt-6 xl:hidden">
          <Button variant="ghost" asChild>
            <Link href="/fleet">{t("detail.backToList")}</Link>
          </Button>
        </div>
      )}
    </>
  );
}
