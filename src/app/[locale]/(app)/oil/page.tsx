import { DropletIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { StatusPill } from "@/components/app/status-pill";
import { oilStatus } from "@/lib/alerts/compute";
import { requireAgency } from "@/lib/auth/session";
import { formatDate, plateNorm } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { OilActions } from "./oil-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("oil") };
}

const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");
const GROUPS = ["due", "soon", "ok", "unknown"] as const;

export default async function OilPage({ searchParams }: PageProps<"/[locale]/oil">) {
  const { agency } = await requireAgency();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const t = await getTranslations("oil");
  const supabase = await createClient();
  const [{ data: cars }, { data: cfg }, { data: history }] = await Promise.all([
    supabase.from("vehicles").select("id, plate, brand_model, current_km, oil_last_km, oil_last_date, oil_next_km").eq("agency_id", agency.id).eq("status", "active"),
    supabase.from("agencies").select("alert_km_before").eq("id", agency.id).single(),
    supabase.from("oil_changes").select("vehicle_id, items, note").eq("agency_id", agency.id).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
  ]);
  // Last vidange of each car: what was changed
  const lastItems = new Map<string, string>();
  for (const h of history ?? []) {
    if (lastItems.has(h.vehicle_id)) continue;
    lastItems.set(h.vehicle_id, h.items.map((i) => (i === "autre" && h.note ? h.note : t(`items.${i}`))).join(", "));
  }
  const alertKm = cfg?.alert_km_before ?? 1500;
  const rows = (cars ?? []).map((c) => ({ ...c, status: oilStatus(c.current_km, c.oil_next_km, alertKm) }));
  rows.sort((a, b) => (a.status.kmLeft ?? 1e12) - (b.status.kmLeft ?? 1e12));

  const needle = q.toLowerCase();
  const shown = q ? rows.filter((r) => plateNorm(r.plate).includes(plateNorm(q)) || r.brand_model.toLowerCase().includes(needle)) : rows;
  type Row = (typeof rows)[number];

  const state = (c: Row) => {
    const s = c.status;
    if (s.state === "unknown") return <StatusPill tone="neutral" label={t("unknown")} />;
    const tone = s.state === "due" ? "danger" : s.state === "soon" ? "warning" : "success";
    const left = s.kmLeft ?? 0;
    return (
      <StatusPill
        tone={tone}
        label={t(s.state)}
        detail={<span data-testid="oil-km-left">{left <= 0 ? t("overBy", { km: nf(-left) }) : t("kmLeft", { km: nf(left) })}</span>}
      />
    );
  };

  const columns: Column<Row>[] = [
    {
      key: "car",
      header: t("car"),
      priority: "primary",
      className: "lg:min-w-44",
      cell: (c) => (
        <span className="flex flex-col">
          <span>{c.brand_model}</span>
          <Ltr className="text-xs font-normal tracking-wide text-muted-foreground">{c.plate}</Ltr>
        </span>
      ),
    },
    { key: "state", header: t("state"), priority: "high", hideLabelInCard: true, className: "w-48", cell: state },
    { key: "current", header: t("currentKm"), priority: "low", align: "end", cell: (c) => <Ltr className="tabular-nums">{nf(c.current_km)} km</Ltr> },
    {
      key: "last",
      header: t("lastChange"),
      priority: "low",
      align: "end",
      cell: (c) => (
        <span className="flex flex-col items-end leading-tight">
          {c.oil_last_km !== null ? <Ltr className="tabular-nums">{nf(c.oil_last_km)} km</Ltr> : "—"}
          {c.oil_last_date ? <Ltr className="text-xs text-muted-foreground">{formatDate(c.oil_last_date)}</Ltr> : null}
          {lastItems.has(c.id) ? (
            <span className="max-w-44 whitespace-normal text-xs text-muted-foreground" data-testid="oil-last-items">
              {lastItems.get(c.id)}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: "next", header: t("nextKm"), priority: "low", align: "end", cell: (c) => (c.oil_next_km !== null ? <Ltr className="font-semibold tabular-nums">{nf(c.oil_next_km)} km</Ltr> : "—") },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { km: nf(alertKm) })} />
      {rows.length === 0 ? (
        <EmptyState icon={DropletIcon} title={t("empty")} />
      ) : (
        <>
          <div className="mb-4 lg:max-w-sm">
            <SearchBar placeholder={t("search")} />
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={SearchXIcon} title={t("noResult")} />
          ) : (
            <ResponsiveList
              testId="oil-groups"
              rowTestId="oil-row"
              caption={t("title")}
              columns={columns}
              rowKey={(c) => c.id}
              rowHref={(c) => `/fleet/${c.id}`}
              groups={GROUPS.map((g) => ({ key: g, label: t(`groups.${g}`), tone: g === "due" ? "danger" : g === "soon" ? "warning" : "default", rows: shown.filter((r) => r.status.state === g) }))}
              actions={(c, mode) => (
                <OilActions
                  compact={mode === "table"}
                  urgent={c.status.state === "due" || c.status.state === "soon"}
                  vehicleId={c.id}
                  label={`${c.brand_model} · ${c.plate}`}
                  currentKm={c.current_km}
                  lastInterval={c.oil_next_km !== null && c.oil_last_km !== null ? c.oil_next_km - c.oil_last_km : null}
                />
              )}
            />
          )}
        </>
      )}
    </>
  );
}
