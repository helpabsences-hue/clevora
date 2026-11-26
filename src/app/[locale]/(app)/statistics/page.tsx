import { BarChart3Icon, BanknoteIcon, CalendarDaysIcon, CarFrontIcon, CarIcon, HandCoinsIcon, FileTextIcon, PercentIcon, TrendingUpIcon, TrophyIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ExcelExport } from "@/components/app/excel-export";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { StatTile } from "@/components/app/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/fields";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { dayKey, formatDate, formatMoney } from "@/lib/format";
import { occupancy, occupancyTone, PERIODS, resolvePeriod, toBuckets, type DailyRow } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/app/status-pill";
import { summarize } from "@/lib/fleet/finance";
import { getProfitability } from "@/lib/fleet/finance-query";
import { getBalances } from "../balances/queries";
import { RevenueChartLazy } from "./components/revenue-chart-lazy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("statistics") };
}

/** Statistiques — admins only (the SQL functions refuse anyone else too). */
export default async function StatisticsPage({ searchParams }: PageProps<"/[locale]/statistics">) {
  const { agency } = await requireRole(["admin"]);
  const sp = await searchParams;
  const today = dayKey(new Date());
  const { period, from, to } = resolvePeriod(sp, today);
  const t = await getTranslations("statistics");
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: daily }, { data: perCar }, { count: carCount }, credit, profit] = await Promise.all([
    supabase.rpc("stats_daily", { p_agency: agency.id, p_from: from, p_to: to }),
    supabase.rpc("stats_by_vehicle", { p_agency: agency.id, p_from: from, p_to: to }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "active"),
    // Crédit clients: money still owed today (not limited to the period)
    getBalances(supabase, agency.id),
    // Rentabilité depuis l'achat (all time, not the period)
    getProfitability(supabase, agency.id),
  ]);
  const profitRows = profit
    .filter((p) => p.status !== "sold")
    .map((p) => ({ ...p, s: summarize(p) }))
    .sort((a, b) => a.s.monthResult - b.s.monthResult);
  const withoutPurchase = (perCar ?? []).filter((c) => !profit.some((p) => p.vehicle_id === c.vehicle_id)).length;
  type ProfitRow = (typeof profitRows)[number];
  const profitColumns: Column<ProfitRow>[] = [
    {
      key: "car",
      header: t("car"),
      priority: "primary",
      cell: (c) => (
        <span className="flex flex-col">
          <span>{c.brand_model}</span>
          <Ltr className="text-xs font-normal text-muted-foreground">{c.plate}</Ltr>
        </span>
      ),
    },
    {
      key: "credit",
      header: t("profit.credit"),
      priority: "high",
      cell: (c) =>
        c.mode === "cash" ? (
          <StatusPill tone="neutral" label={t("profit.cash")} />
        ) : c.s.creditRunning ? (
          <StatusPill tone="info" label={t("profit.monthsLeft", { count: c.s.monthsLeft })} detail={<Ltr>{formatMoney(c.credit_left)}</Ltr>} />
        ) : (
          <StatusPill tone="success" label={t("profit.creditDone")} />
        ),
    },
    { key: "rent", header: t("profit.rentMonth"), priority: "low", align: "end", cell: (c) => <Ltr>{formatMoney(c.revenue_month)}</Ltr> },
    { key: "damagesMonth", header: t("profit.damagesMonth"), priority: "low", align: "end", cell: (c) => (c.damages_month > 0 ? <Ltr>{formatMoney(c.damages_month)}</Ltr> : <span className="text-muted-foreground">—</span>) },
    { key: "charges", header: t("profit.chargesMonth"), priority: "low", align: "end", cell: (c) => <Ltr>{formatMoney(c.charges_month)}</Ltr> },
    { key: "creditMonth", header: t("profit.creditMonth"), priority: "low", align: "end", cell: (c) => <Ltr>{formatMoney(c.credit_month)}</Ltr> },
    {
      key: "month",
      header: t("profit.resultMonth"),
      priority: "high",
      align: "end",
      cell: (c) => <Ltr className={cn("font-bold", c.s.monthResult < 0 ? "text-destructive" : "text-success")}>{formatMoney(c.s.monthResult)}</Ltr>,
    },
    {
      key: "result",
      header: t("profit.result"),
      priority: "low",
      align: "end",
      cell: (c) => <Ltr className={cn("font-semibold", c.s.result < 0 ? "text-destructive" : "text-success")}>{formatMoney(c.s.result)}</Ltr>,
    },
  ];
  const rows = (daily ?? []) as DailyRow[];
  const buckets = toBuckets(rows, from, to, today);
  const days = rows.length;
  const revenue = buckets.reduce((s, b) => s + b.revenue, 0);
  const charges = buckets.reduce((s, b) => s + b.charges, 0);
  // Damage fees kept at return: income on their own, added to the profit
  const damages = buckets.reduce((s, b) => s + b.damages, 0);
  const rentedDays = buckets.reduce((s, b) => s + b.rentedDays, 0);
  const cars = (perCar ?? [])
    .map((c) => {
      const rev = Number(c.revenue);
      const ch = Number(c.charges);
      const dmg = Number(c.damages);
      return { ...c, revenue: rev, charges: ch, damages: dmg, net: rev + dmg - ch, occupancy: occupancy(c.rented_days, 1, days) };
    })
    .sort((a, b) => b.net - a.net);
  const best = cars.find((c) => c.revenue > 0);
  const labels = Object.fromEntries(
    buckets.map((b) => [
      b.key,
      b.key.length === 7
        ? format.dateTime(new Date(`${b.from}T12:00:00Z`), { month: "short", year: "2-digit" })
        : format.dateTime(new Date(`${b.from}T12:00:00Z`), { day: "2-digit", month: "2-digit" }),
    ]),
  );

  const columns: Column<(typeof cars)[number]>[] = [
    { key: "car", header: t("car"), priority: "primary", cell: (c) => <span>{c.brand_model} <Ltr className="text-sm font-normal text-muted-foreground">{c.plate}</Ltr></span> },
    { key: "net", header: t("net"), priority: "high", align: "end", cell: (c) => <Ltr className={cn("font-bold", c.net < 0 && "text-destructive")}>{formatMoney(c.net)}</Ltr> },
    { key: "occupancy", header: t("occupancy"), priority: "high", hideLabelInCard: true, cell: (c) => <Badge variant={occupancyTone(c.occupancy)}>{t("occupancyValue", { pct: c.occupancy })}</Badge> },
    { key: "revenue", header: t("revenue"), priority: "low", align: "end", cell: (c) => <Ltr>{formatMoney(c.revenue)}</Ltr> },
    { key: "damages", header: t("damages"), priority: "low", align: "end", cell: (c) => (c.damages > 0 ? <Ltr>{formatMoney(c.damages)}</Ltr> : <span className="text-muted-foreground">—</span>) },
    { key: "charges", header: t("carCharges"), priority: "low", align: "end", cell: (c) => <Ltr>{formatMoney(c.charges)}</Ltr> },
    { key: "days", header: t("daysRented"), priority: "low", align: "end", cell: (c) => <Ltr>{c.rented_days}</Ltr> },
  ];
  const qs = `from=${from}&to=${to}`;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={<>{t("period")} <Ltr>{formatDate(from)}</Ltr> – <Ltr>{formatDate(to)}</Ltr></>}
        action={
          <>
            <ExcelExport
              fileName={`statistiques-${from}-${to}.xlsx`}
              label={t("exportExcel")}
              header={[t("periodColumn"), t("revenue"), t("damages"), t("charges"), t("net"), t("daysRented")]}
              rows={[
                ...buckets.map((b) => [labels[b.key], b.revenue, b.damages, b.charges, b.net, b.rentedDays]),
                [],
                [t("car"), t("revenue"), t("damages"), t("carCharges"), t("net"), t("daysRented"), t("occupancy")],
                ...cars.map((c) => [`${c.brand_model} ${c.plate}`, c.revenue, c.damages, c.charges, c.net, c.rented_days, `${c.occupancy} %`]),
              ]}
            />
            <Button variant="outline" size="lg" asChild>
              <a href={`/api/statistics/pdf?${qs}`} target="_blank" rel="noopener">
                <FileTextIcon aria-hidden />
                {t("exportPdf")}
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <nav aria-label={t("periodLabel")} className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={p === "custom" ? `/statistics?period=custom&${qs}` : `/statistics?period=${p}`}
              aria-current={period === p ? "page" : undefined}
              className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", period === p ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
            >
              {t(`periods.${p}`)}
            </Link>
          ))}
        </nav>
        {period === "custom" ? (
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="period" value="custom" />
            <div className="flex flex-col gap-2">
              <Label htmlFor="stats-from">{t("from")}</Label>
              <DateInput id="stats-from" name="from" defaultValue={from} required className="w-44" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stats-to">{t("to")}</Label>
              <DateInput id="stats-to" name="to" defaultValue={to} required className="w-44" />
            </div>
            <Button type="submit" size="lg">
              <CalendarDaysIcon aria-hidden />
              {t("apply")}
            </Button>
          </form>
        ) : null}
      </div>

      <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">
        <li className="col-span-2 2xl:col-span-1">
          <StatTile
            label={t("credit")}
            value={<Ltr>{formatMoney(credit.reduce((s, r) => s + r.balance, 0))}</Ltr>}
            hint={t("creditHint", { count: credit.length })}
            icon={HandCoinsIcon}
            tone={credit.length ? "danger" : "success"}
            href="/balances"
            testId="stats-credit"
          />
        </li>
        <li><StatTile label={t("revenue")} value={<Ltr>{formatMoney(revenue)}</Ltr>} icon={WalletIcon} tone="success" testId="stats-revenue" /></li>
        <li><StatTile label={t("damages")} value={<Ltr>{formatMoney(damages)}</Ltr>} hint={t("damagesHint")} icon={CarFrontIcon} testId="stats-damages" /></li>
        <li><StatTile label={t("charges")} value={<Ltr>{formatMoney(charges)}</Ltr>} icon={WalletIcon} tone="warning" testId="stats-charges" /></li>
        <li><StatTile label={t("net")} value={<Ltr>{formatMoney(revenue + damages - charges)}</Ltr>} icon={TrendingUpIcon} tone={revenue + damages - charges < 0 ? "danger" : "success"} testId="stats-net" /></li>
        <li><StatTile label={t("daysRented")} value={rentedDays} icon={CalendarDaysIcon} /></li>
        <li><StatTile label={t("occupancy")} value={<Ltr>{occupancy(rentedDays, carCount ?? 0, days)} %</Ltr>} icon={PercentIcon} testId="stats-occupancy" /></li>
        <li><StatTile label={t("bestCar")} value={<span className="text-lg sm:text-xl">{best ? best.brand_model : "—"}</span>} hint={best ? <Ltr>{best.plate}</Ltr> : undefined} icon={TrophyIcon} /></li>
      </ul>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3Icon className="size-5 text-muted-foreground" aria-hidden />
            {buckets[0]?.key.length === 7 ? t("revenueByMonth") : t("revenueByDay")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChartLazy buckets={buckets} labels={labels} />
          <details className="mt-3 text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-muted-foreground">{t("showTable")}</summary>
            <table className="mt-2 w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 text-start font-medium">{t("periodColumn")}</th>
                  <th scope="col" className="py-1 text-end font-medium">{t("revenue")}</th>
                  <th scope="col" className="py-1 text-end font-medium">{t("damages")}</th>
                  <th scope="col" className="py-1 text-end font-medium">{t("charges")}</th>
                  <th scope="col" className="py-1 text-end font-medium">{t("net")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {buckets.map((b) => (
                  <tr key={b.key}>
                    <td className="py-1">{labels[b.key]}{b.partial ? ` (${t("partial")})` : ""}</td>
                    <td className="py-1 text-end"><Ltr>{formatMoney(b.revenue)}</Ltr></td>
                    <td className="py-1 text-end"><Ltr>{formatMoney(b.damages)}</Ltr></td>
                    <td className="py-1 text-end"><Ltr>{formatMoney(b.charges)}</Ltr></td>
                    <td className="py-1 text-end"><Ltr>{formatMoney(b.net)}</Ltr></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </CardContent>
      </Card>

      <section aria-labelledby="perf-title">
        <h2 id="perf-title" className="mb-1 flex items-center gap-2 text-xl font-bold">
          <CarIcon className="size-5 text-muted-foreground" aria-hidden />
          {t("perCar")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("perCarHint")}</p>
        <ResponsiveList rows={cars} columns={columns} rowKey={(c) => c.vehicle_id} rowHref={(c) => `/fleet/${c.vehicle_id}`} caption={t("perCar")} testId="per-car" />
      </section>

      <section aria-labelledby="profit-title" className="mt-8">
        <h2 id="profit-title" className="mb-1 flex items-center gap-2 text-xl font-bold">
          <BanknoteIcon className="size-5 text-muted-foreground" aria-hidden />
          {t("profit.title")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("profit.hint")}</p>
        {profitRows.length ? (
          <ResponsiveList rows={profitRows} columns={profitColumns} rowKey={(c) => c.vehicle_id} rowHref={(c) => `/fleet/${c.vehicle_id}`} caption={t("profit.title")} testId="profit-list" rowTestId="profit-row" />
        ) : null}
        {withoutPurchase ? (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground" data-testid="profit-missing">
            {t("profit.missing", { count: withoutPurchase })}
          </p>
        ) : null}
      </section>
    </>
  );
}
