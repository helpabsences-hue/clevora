import { CoinsIcon, HandCoinsIcon, MessageCircleIcon, PhoneIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { formatDate, formatMoney, plateNorm } from "@/lib/format";
import { formatPhone, whatsappNumber } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getBalances, type BalanceRow as Row } from "./queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("balances") };
}

/**
 * Restes à payer: clients who rented (car out or returned) and still owe money.
 * Returned rentals first (the money is due now), then rentals still running.
 * Staff see it too: they collect the money at the desk.
 */
export default async function BalancesPage({ searchParams }: PageProps<"/[locale]/balances">) {
  const { agency } = await requireAgency();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const t = await getTranslations("balances");
  const supabase = await createClient();

  const rows = await getBalances(supabase, agency.id);

  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^0/, "");
  const shown = q
    ? rows.filter(
        (r) =>
          (r.client?.full_name ?? "").toLowerCase().includes(needle) ||
          (r.client?.id_number ?? "").toLowerCase().includes(needle) ||
          r.contract_number.toLowerCase().includes(needle) ||
          (digits.length >= 4 && (r.client?.phone ?? "").includes(digits)) ||
          (r.vehicle ? plateNorm(r.vehicle.plate).includes(plateNorm(q)) : false),
      )
    : rows;
  const sum = (list: Row[]) => list.reduce((s, r) => s + r.balance, 0);
  const totalOwed = sum(rows);

  const columns: Column<Row>[] = [
    {
      key: "client",
      header: t("client"),
      priority: "primary",
      className: "lg:min-w-48",
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.client?.full_name}</span>
          {r.client?.phone ? <Ltr className="text-xs font-normal text-muted-foreground">{formatPhone(r.client.phone)}</Ltr> : null}
        </span>
      ),
    },
    {
      key: "contract",
      header: t("contract"),
      priority: "low",
      cell: (r) => (
        <span className="flex flex-col">
          <Ltr>{r.contract_number}</Ltr>
          {r.vehicle ? (
            <span className="text-xs text-muted-foreground">
              {r.vehicle.brand_model} · <Ltr>{r.vehicle.plate}</Ltr>
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "end",
      header: t("end"),
      priority: "low",
      nowrap: true,
      cell: (r) =>
        r.status === "returned" ? (
          <StatusPill tone="danger" label={<Ltr>{formatDate(r.actual_return_at ?? r.end_at)}</Ltr>} detail={t("returned")} />
        ) : (
          <StatusPill tone="info" label={<Ltr>{formatDate(r.end_at)}</Ltr>} detail={t("onRental")} />
        ),
    },
    { key: "total", header: t("total"), priority: "low", align: "end", cell: (r) => <Ltr>{formatMoney(r.total)}</Ltr> },
    { key: "paid", header: t("paid"), priority: "low", align: "end", cell: (r) => <Ltr>{formatMoney(r.paid)}</Ltr> },
    {
      key: "balance",
      header: t("balance"),
      priority: "high",
      align: "end",
      cell: (r) => <Ltr className="text-base font-bold text-destructive">{formatMoney(r.balance)}</Ltr>,
    },
  ];

  const groups = (["returned", "on_rental"] as const).map((g) => {
    const list = shown.filter((r) => r.status === g);
    return {
      key: g,
      tone: g === "returned" ? ("danger" as const) : ("warning" as const),
      label: (
        <>
          {t(`groups.${g}`)} · <Ltr>{formatMoney(sum(list))}</Ltr>
        </>
      ),
      rows: list,
    };
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {rows.length === 0 ? (
        <EmptyState icon={CoinsIcon} title={t("empty")} description={t("emptyBody")} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3" data-testid="balances-total">
              <HandCoinsIcon className="size-6 text-destructive" aria-hidden />
              <span className="flex flex-col leading-tight">
                <span className="text-sm text-muted-foreground">{t("totalOwed", { count: rows.length })}</span>
                <Ltr className="text-2xl font-extrabold">{formatMoney(totalOwed)}</Ltr>
              </span>
            </div>
            <div className="sm:w-80">
              <SearchBar placeholder={t("search")} />
            </div>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={SearchXIcon} title={t("noResult")} />
          ) : (
            <ResponsiveList
              testId="balances-list"
              rowTestId="balance-row"
              caption={t("title")}
              columns={columns}
              rowKey={(r) => r.id}
              rowHref={(r) => `/reservations/${r.id}`}
              groups={groups.filter((g) => g.rows.length)}
              actions={(r, mode) => (
                <span className={cn("flex items-center gap-1.5", mode === "card" && "w-full flex-wrap")}>
                  {r.client?.phone ? (
                    <>
                      <Button variant="outline" size="icon" asChild>
                        <a href={`tel:${r.client.phone}`} aria-label={t("call", { name: r.client.full_name })} title={t("callShort")}>
                          <PhoneIcon aria-hidden />
                        </a>
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a href={`https://wa.me/${whatsappNumber(r.client.phone)}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${r.client.full_name}`} title="WhatsApp">
                          <MessageCircleIcon aria-hidden />
                        </a>
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" asChild className={cn(mode === "card" && "flex-1")}>
                    <Link href={`/reservations/${r.id}?do=payment`}>
                      <CoinsIcon aria-hidden />
                      {t("collect")}
                    </Link>
                  </Button>
                </span>
              )}
            />
          )}
        </>
      )}
    </>
  );
}
