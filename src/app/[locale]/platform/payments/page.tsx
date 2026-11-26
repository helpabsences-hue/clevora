import { FileDownIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PaymentActions } from "../components/payment-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("paymentsTitle") };
}

const FILTERS = ["all", "pending", "paid", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];

/** Every subscription payment: confirm the pending ones, download invoices. */
export default async function PlatformPaymentsPage({ searchParams }: PageProps<"/[locale]/platform/payments">) {
  const sp = await searchParams;
  const filter: Filter = FILTERS.includes(sp.status as Filter) ? (sp.status as Filter) : "all";
  const t = await getTranslations("platform");
  const supabase = await createClient();
  let query = supabase
    .from("subscription_payments")
    .select("id, created_at, period, amount, method, reference, status, invoice_number, paid_at, plan:plans(name), agency:agencies(id, name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filter !== "all") query = query.eq("status", filter);
  const { data } = await query;
  const rows = data ?? [];
  type Row = (typeof rows)[number];
  const total = rows.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  const columns: Column<Row>[] = [
    {
      key: "agency",
      header: t("agency"),
      priority: "primary",
      cell: (p) => (
        <span className="flex flex-col">
          <span>{p.agency?.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {p.plan?.name} ({p.period === "year" ? t("year") : t("month")})
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      priority: "high",
      hideLabelInCard: true,
      cell: (p) => <Badge variant={p.status === "paid" ? "success" : p.status === "pending" ? "warning" : "neutral"}>{t(`payStatus.${p.status}`)}</Badge>,
    },
    { key: "amount", header: t("amount"), priority: "high", align: "end", cell: (p) => <Ltr className="font-bold">{formatMoney(p.amount)}</Ltr> },
    { key: "date", header: t("date"), priority: "low", cell: (p) => <Ltr>{formatDate(p.paid_at ?? p.created_at)}</Ltr> },
    {
      key: "ref",
      header: t("reference"),
      priority: "low",
      cell: (p) => (
        <span className="flex flex-col text-sm">
          <Ltr>{p.invoice_number ?? p.reference}</Ltr>
          <span className="text-xs text-muted-foreground">{t(`methods.${p.method}`)}</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t("paymentsTitle")} subtitle={t("paymentsSubtitle", { total: formatMoney(total) })} />
      <nav aria-label={t("filterLabel")} className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/platform/payments" : `/platform/payments?status=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
              filter === f ? "border-primary bg-primary text-primary-foreground dark:border-ring dark:bg-ring dark:text-background" : "bg-card hover:bg-accent",
            )}
          >
            {f === "all" ? t("filters.all") : t(`payStatus.${f}`)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">{t("paymentsNone")}</p>
      ) : (
        <ResponsiveList
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          caption={t("paymentsTitle")}
          testId="platform-payments"
          actions={(p) =>
            p.status === "pending" ? (
              <PaymentActions id={p.id} label={`${p.agency?.name ?? ""} · ${p.reference} · ${formatMoney(p.amount)}`} />
            ) : p.status === "paid" ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/invoices/${p.id}`} target="_blank" rel="noopener">
                  <FileDownIcon aria-hidden />
                  {t("invoice")}
                </a>
              </Button>
            ) : null
          }
        />
      )}
    </>
  );
}
