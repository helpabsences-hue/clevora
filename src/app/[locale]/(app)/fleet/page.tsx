import { CarIcon, PlusIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { SelectAllBox, SelectBox, SelectionProvider } from "@/components/app/selection";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { AGE_WARNING_YEARS, vehicleAgeYears } from "@/lib/fleet/status";
import { formatMoney, plateNorm } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FleetBulkBar } from "./components/fleet-bulk-bar";
import { ImportDialog } from "./components/import-dialog";
import { VehicleStatusBadge } from "./components/status-badge";
import { VehicleActions } from "./components/vehicle-actions";
import { getVehicleUsage, listVehicles, type FleetVehicle } from "./queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("fleet") };
}

const TABS = ["all", "available", "on_rental", "maintenance"] as const;
type Tab = (typeof TABS)[number];

function inTab(v: FleetVehicle, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "available") return v.computed.kind === "available" || v.computed.kind === "reserved_today";
  return v.computed.kind === tab;
}

export default async function FleetPage({ searchParams }: PageProps<"/[locale]/fleet">) {
  const { agency } = await requireAgency();
  const isAdmin = agency.role === "admin";
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const t = await getTranslations("fleet");
  const supabase = await createClient();
  const [all, usage] = await Promise.all([listVehicles(supabase, agency.id), isAdmin ? getVehicleUsage(supabase, agency.id) : null]);

  const active = all.filter((v) => v.status === "active");
  const sold = all.filter((v) => v.status === "sold");
  const counts = Object.fromEntries(TABS.map((k) => [k, active.filter((v) => inTab(v, k)).length])) as Record<Tab, number>;
  const needle = q.toLowerCase();
  const matches = (v: FleetVehicle) =>
    !q || plateNorm(v.plate).includes(plateNorm(q)) || v.brand_model.toLowerCase().includes(needle);
  const rows = [...active.filter((v) => inTab(v, tab)), ...(tab === "all" ? sold : [])].filter(matches);

  const nf = new Intl.NumberFormat("fr-FR");
  const columns: Column<FleetVehicle>[] = [
    {
      key: "car",
      header: t("columns.car"),
      priority: "primary",
      cell: (v) => (
        <span className="flex items-center gap-3">
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground lg:inline-flex" aria-hidden>
            <CarIcon className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{v.brand_model}</span>
            <Ltr className="text-xs font-normal tracking-wide text-muted-foreground">{v.plate}</Ltr>
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      priority: "high",
      hideLabelInCard: true,
      className: "w-44",
      cell: (v) => <VehicleStatusBadge status={v.computed} />,
    },
    {
      key: "type",
      header: t("columns.type"),
      priority: "high",
      cell: (v) => (
        <span className="flex flex-col leading-tight">
          <span>{t(`categories.${v.category}`)}</span>
          <span className="text-xs text-muted-foreground">
            {t(`fuels.${v.fuel}`)} · {t(`gearboxes.${v.gearbox}`)}
          </span>
        </span>
      ),
    },
    {
      key: "km",
      header: t("columns.km"),
      priority: "low",
      align: "end",
      cell: (v) => <Ltr className="tabular-nums">{nf.format(v.current_km).replace(/\s/g, " ")} km</Ltr>,
    },
    { key: "rate", header: t("columns.rate"), priority: "low", align: "end", cell: (v) => <Ltr className="font-semibold tabular-nums">{formatMoney(v.daily_rate)}</Ltr> },
    {
      key: "age",
      header: t("columns.age"),
      priority: "low",
      align: "end",
      cell: (v) => {
        const age = vehicleAgeYears(v.first_registration_date);
        if (age === null) return <span className="text-muted-foreground">—</span>;
        return <span className={cn(age >= AGE_WARNING_YEARS && "font-semibold text-warning")}>{t("age", { years: age })}</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={usage ? t("usage", { count: usage.count, max: usage.max ?? "∞" }) : t("subtitle", { count: active.length })}
        action={
          isAdmin ? (
            <>
              <ImportDialog />
              {usage?.atLimit ? (
                <Button size="lg" disabled>
                  <PlusIcon aria-hidden />
                  {t("add")}
                </Button>
              ) : (
                <Button size="lg" asChild>
                  <Link href="/fleet/new">
                    <PlusIcon aria-hidden />
                    {t("add")}
                  </Link>
                </Button>
              )}
            </>
          ) : null
        }
      />

      {usage?.atLimit ? (
        <Alert variant="warning" className="mb-4 flex-wrap items-center">
          <CarIcon aria-hidden />
          <span className="flex-1">{t("limitReached", { max: usage.max ?? 0, plan: usage.planName ?? "" })}</span>
          <Link href="/billing" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
            {t("upgrade")}
          </Link>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={t("filters")} className="flex flex-wrap gap-2">
          {TABS.map((k) => (
            <Link
              key={k}
              href={k === "all" ? (q ? `/fleet?q=${encodeURIComponent(q)}` : "/fleet") : `/fleet?tab=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={tab === k ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                tab === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {t(`tabs.${k}`)}
              <span className={cn("rounded-full px-1.5 text-xs", tab === k ? "bg-white/20" : "bg-muted")}>{counts[k]}</span>
            </Link>
          ))}
        </nav>
        <div className="lg:w-80">
          <SearchBar placeholder={t("search")} />
        </div>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={CarIcon}
          title={t("empty.title")}
          description={isAdmin ? t("empty.admin") : t("empty.staff")}
          action={
            isAdmin ? (
              <Button size="lg" asChild>
                <Link href="/fleet/new">
                  <PlusIcon aria-hidden />
                  {t("add")}
                </Link>
              </Button>
            ) : null
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchXIcon} title={t("noResult.title")} description={t("noResult.body")} />
      ) : (
        <SelectionProvider>
          {isAdmin ? (
            <div className="mb-2 flex items-center gap-2 ps-3 text-sm text-muted-foreground lg:hidden">
              <SelectAllBox ids={rows.map((v) => v.id)} label={t("bulk.selectAll")} />
              {t("bulk.selectAll")}
            </div>
          ) : null}
          <ResponsiveList
            rows={rows}
            columns={columns}
            select={isAdmin ? { cell: (v) => <SelectBox id={v.id} label={t("bulk.select", { car: `${v.brand_model} · ${v.plate}` })} />, all: <SelectAllBox ids={rows.map((v) => v.id)} label={t("bulk.selectAll")} /> } : undefined}
            rowKey={(v) => v.id}
          rowHref={(v) => `/fleet/${v.id}`}
          caption={t("title")}
          testId="fleet-list"
          actions={(v, mode) => (
            <VehicleActions
              compact={mode === "table"}
              vehicleId={v.id}
              vehicleLabel={`${v.brand_model} · ${v.plate}`}
              openMaintenanceId={v.openMaintenanceId}
              sold={v.status === "sold"}
            />
          )}
          />
          {isAdmin ? <FleetBulkBar /> : null}
        </SelectionProvider>
      )}
    </>
  );
}
