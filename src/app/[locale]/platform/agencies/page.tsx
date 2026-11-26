import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("agenciesTitle") };
}

const STATUS_TONE = { trial: "info", active: "success", past_due: "warning", suspended: "danger", cancelled: "neutral" } as const;
const FILTERS = ["all", "trial", "active", "read_only", "past_due", "suspended", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];

/** Every agency, filterable by subscription state. */
export default async function PlatformAgenciesPage({ searchParams }: PageProps<"/[locale]/platform/agencies">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const filter: Filter = FILTERS.includes(sp.status as Filter) ? (sp.status as Filter) : "all";
  const t = await getTranslations("platform");
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_overview");
  const all = data ?? [];
  type Row = (typeof all)[number];
  const inFilter = (a: Row) =>
    filter === "all" ? true : filter === "read_only" ? !a.writable : filter === "trial" || filter === "active" ? a.subscription_status === filter && a.writable : a.subscription_status === filter;
  const rows = all.filter((a) => inFilter(a) && (!q || a.name.toLowerCase().includes(q) || a.slug.includes(q) || (a.city ?? "").toLowerCase().includes(q)));
  const count = (f: Filter) => all.filter((a) => (f === "all" ? true : f === "read_only" ? !a.writable : f === "trial" || f === "active" ? a.subscription_status === f && a.writable : a.subscription_status === f)).length;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("agency"),
      priority: "primary",
      cell: (a) => (
        <span className="flex flex-col">
          <span>{a.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {a.city ?? "—"} · {t("since", { date: formatDate(a.created_at) })}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      priority: "high",
      hideLabelInCard: true,
      cell: (a) => (
        <Badge variant={a.writable ? STATUS_TONE[a.subscription_status as keyof typeof STATUS_TONE] : "danger"}>
          {t(`statuses.${a.subscription_status}`)}
          {a.writable ? "" : ` · ${t("readOnly")}`}
        </Badge>
      ),
    },
    { key: "plan", header: t("plan"), priority: "high", cell: (a) => a.plan_name ?? "—" },
    { key: "until", header: t("until"), priority: "low", cell: (a) => <Ltr>{formatDate(a.subscription_status === "trial" ? a.trial_ends_at : a.current_period_end) || "—"}</Ltr> },
    { key: "cars", header: t("cars"), priority: "low", align: "end", cell: (a) => <Ltr>{a.vehicles}</Ltr> },
    { key: "members", header: t("members"), priority: "low", align: "end", cell: (a) => <Ltr>{a.members}</Ltr> },
    { key: "res", header: t("reservations30"), priority: "low", align: "end", cell: (a) => <Ltr>{a.reservations_30d}</Ltr> },
  ];

  return (
    <>
      <PageHeader title={t("agenciesTitle")} subtitle={t("agenciesSubtitle", { count: all.length })} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === "all" ? "/platform/agencies" : `/platform/agencies?status=${f}`}
              aria-current={filter === f ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                filter === f ? "border-primary bg-primary text-primary-foreground dark:border-ring dark:bg-ring dark:text-background" : "bg-card hover:bg-accent",
              )}
            >
              {t(`filters.${f}`)}
              <span className="text-xs opacity-80">{count(f)}</span>
            </Link>
          ))}
        </nav>
        <div className="lg:w-72">
          <SearchBar placeholder={t("search")} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">{t("noAgency")}</p>
      ) : (
        <ResponsiveList rows={rows} columns={columns} rowKey={(a) => a.id} rowHref={(a) => `/platform/agencies/${a.id}`} caption={t("agenciesTitle")} testId="platform-list" />
      )}
    </>
  );
}
