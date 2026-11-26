import { BanknoteIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { ProgressBar } from "@/components/app/progress-bar";
import { StatusPill } from "@/components/app/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarize, type FinanceInput, type Profitability } from "@/lib/fleet/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FinanceDialog } from "./finance-dialog";

/** Car page (admins): purchase, credit progress and whether the car pays for itself. */
export async function FinanceCard({ vehicleId, label, row }: { vehicleId: string; label: string; row: Profitability | null }) {
  const t = await getTranslations("fleet.finance");
  const defaults: FinanceInput | null = row
    ? {
        purchase_date: row.purchase_date,
        purchase_price: row.purchase_price,
        mode: row.mode,
        down_payment: row.down_payment,
        monthly_payment: row.monthly_payment,
        months: row.months,
        first_payment_on: row.first_payment_on ?? "",
        lender: row.lender ?? "",
      }
    : null;
  const s = row ? summarize(row) : null;
  const line = (k: string, v: React.ReactNode, strong = false) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("text-end", strong && "font-bold")}>{v}</dd>
    </div>
  );

  return (
    <Card className="lg:col-span-2" data-testid="finance-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <BanknoteIcon className="size-5 text-muted-foreground" aria-hidden />
          {t("title")}
        </CardTitle>
        <FinanceDialog vehicleId={vehicleId} label={label} defaults={defaults} />
      </CardHeader>
      <CardContent>
        {!row || !s ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <section aria-label={t("purchase")} className="flex flex-col gap-2">
              <dl className="divide-y">
                {line(t("purchaseDate"), <Ltr>{formatDate(row.purchase_date)}</Ltr>)}
                {line(t("purchasePrice"), <Ltr>{formatMoney(row.purchase_price)}</Ltr>)}
                {row.mode === "cash"
                  ? line(t("mode"), t("cash"))
                  : (
                    <>
                      {line(t("mode"), row.lender ? `${t("credit")} · ${row.lender}` : t("credit"))}
                      {line(t("creditPerMonth"), <Ltr>{formatMoney(row.monthly_payment ?? 0)}</Ltr>)}
                      {line(t("paidMonths"), <Ltr>{`${row.months_paid} / ${row.months}`}</Ltr>)}
                      {line(t("creditLeft"), <Ltr>{formatMoney(row.credit_left)}</Ltr>, true)}
                    </>
                  )}
              </dl>
              {row.mode === "credit" ? (
                <div className="flex flex-col gap-1.5">
                  <ProgressBar value={((row.months_paid) / (row.months ?? 1)) * 100} label={t("creditProgress")} tone={s.creditRunning ? "primary" : "success"} />
                  {s.creditRunning ? (
                    <StatusPill tone="info" label={t("monthsLeft", { count: s.monthsLeft })} detail={<>{t("endsOn")} <Ltr>{formatDate(s.creditEnd)}</Ltr></>} testId="finance-credit-state" />
                  ) : (
                    <StatusPill tone="success" label={t("creditDone")} testId="finance-credit-state" />
                  )}
                </div>
              ) : null}
            </section>
            <section aria-label={t("profit")} className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{t("sincePurchase")}</p>
              <dl className="divide-y">
                {line(t("revenueSince"), <Ltr>{formatMoney(row.revenue)}</Ltr>)}
                {line(t("chargesSince"), <Ltr>{formatMoney(row.charges)}</Ltr>)}
                {line(row.mode === "cash" ? t("paidCash") : t("creditPaid"), <Ltr>{formatMoney(row.paid_so_far)}</Ltr>)}
                {line(t("result"), <Ltr className={s.result < 0 ? "text-destructive" : "text-success"}>{formatMoney(s.result)}</Ltr>, true)}
              </dl>
              <ProgressBar value={s.paybackPct} label={t("payback", { pct: s.paybackPct })} tone={s.paidBack ? "success" : "warning"} />
              <StatusPill tone={s.paidBack ? "success" : "warning"} label={s.paidBack ? t("paidBack") : t("payback", { pct: s.paybackPct })} testId="finance-payback" />
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
