import { SearchXIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { StatusPill } from "@/components/app/status-pill";
import { dateStatus, paperGroup, type DateStatus, type PaperGroup } from "@/lib/alerts/compute";
import { requireAgency } from "@/lib/auth/session";
import { dayKey, formatDate, plateNorm } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PapersSheet } from "./papers-sheet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("insurance") };
}

const GROUPS: PaperGroup[] = ["expired", "week", "month", "later"];

export default async function InsurancePage({ searchParams }: PageProps<"/[locale]/insurance">) {
  const { agency } = await requireAgency();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const t = await getTranslations("insurance");
  const supabase = await createClient();
  const [{ data: cars }, { data: cfg }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, plate, brand_model, insurance_expires_on, technical_visit_expires_on, insurer, policy_number")
      .eq("agency_id", agency.id)
      .eq("status", "active"),
    supabase.from("agencies").select("alert_days_before").eq("id", agency.id).single(),
  ]);
  const today = dayKey(new Date());
  const alertDays = cfg?.alert_days_before ?? 30;
  const rows = (cars ?? []).map((c) => {
    const ins = dateStatus(c.insurance_expires_on, today, alertDays);
    const vis = dateStatus(c.technical_visit_expires_on, today, alertDays);
    const nearest = [ins.daysLeft, vis.daysLeft].filter((x): x is number => x !== null);
    const min = nearest.length ? Math.min(...nearest) : null;
    return { ...c, ins, vis, min, group: paperGroup(min) };
  });
  rows.sort((a, b) => (a.min ?? 1e9) - (b.min ?? 1e9));

  const needle = q.toLowerCase();
  const shown = q ? rows.filter((r) => plateNorm(r.plate).includes(plateNorm(q)) || r.brand_model.toLowerCase().includes(needle) || (r.insurer ?? "").toLowerCase().includes(needle)) : rows;
  type Row = (typeof rows)[number];

  /** Date with a coloured dot, and how long is left underneath. */
  const paper = (date: string | null, s: DateStatus) => {
    if (s.state === "unknown") return <StatusPill tone="neutral" label={t("unknown")} />;
    const tone = s.state === "expired" ? "danger" : s.state === "soon" ? "warning" : "success";
    return <StatusPill tone={tone} label={<Ltr>{formatDate(date)}</Ltr>} detail={s.state === "expired" ? t("expired") : t("inDays", { days: s.daysLeft ?? 0 })} />;
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
    { key: "ins", header: t("insuranceEnd"), priority: "high", cell: (c) => paper(c.insurance_expires_on, c.ins) },
    { key: "vis", header: t("visitEnd"), priority: "high", cell: (c) => paper(c.technical_visit_expires_on, c.vis) },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { days: alertDays })} />
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheckIcon} title={t("empty")} />
      ) : (
        <>
          <div className="mb-4 lg:max-w-sm">
            <SearchBar placeholder={t("search")} />
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={SearchXIcon} title={t("noResult")} />
          ) : (
            <ResponsiveList
              testId="insurance-groups"
              rowTestId="insurance-row"
              caption={t("title")}
              columns={columns}
              rowKey={(c) => c.id}
              rowHref={(c) => `/fleet/${c.id}`}
              groups={GROUPS.map((g) => ({ key: g, label: t(`groups.${g}`), tone: g === "expired" ? "danger" : g === "week" ? "warning" : "default", rows: shown.filter((r) => r.group === g) }))}
              actions={(c) => (
                <PapersSheet vehicleId={c.id} label={`${c.brand_model} · ${c.plate}`} insurance={c.insurance_expires_on} visit={c.technical_visit_expires_on} insurer={c.insurer} policy={c.policy_number} />
              )}
            />
          )}
        </>
      )}
    </>
  );
}
