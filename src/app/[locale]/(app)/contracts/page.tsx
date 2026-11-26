import { FileSignatureIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { SearchBar } from "@/components/app/search-bar";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ReservationTable } from "../reservations/components/reservation-table";
import type { ListedReservation } from "../reservations/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("contracts") };
}

const TABS = ["toSign", "active", "closed", "cancelled"] as const;
type Tab = (typeof TABS)[number];

function tabOf(r: { status: string; signed_at: string | null }): Tab | null {
  if (r.status === "reserved") return r.signed_at ? null : "toSign";
  if (r.status === "on_rental") return "active";
  if (r.status === "returned") return "closed";
  return "cancelled";
}

export default async function ContractsPage({ searchParams }: PageProps<"/[locale]/contracts">) {
  const { agency } = await requireAgency();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "toSign";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const t = await getTranslations("contracts");
  const supabase = await createClient();

  let ids: string[] | null = null;
  if (q.length >= 2) {
    const { data } = await supabase.rpc("search_reservation_ids", { p_agency: agency.id, p_q: q });
    ids = (data ?? []) as unknown as string[];
  }
  let query = supabase
    .from("reservations")
    .select(
      "id, contract_number, status, start_at, end_at, actual_return_at, signed_at, delivery, delivery_place, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone)",
    )
    .eq("agency_id", agency.id)
    .order("start_at", { ascending: false })
    .limit(1000);
  if (ids) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await query;
  const all = (data ?? []) as unknown as Omit<ListedReservation, "balance">[];
  const counts = Object.fromEntries(TABS.map((k) => [k, all.filter((r) => tabOf(r) === k).length])) as Record<Tab, number>;
  const rows = all.filter((r) => tabOf(r) === tab);
  const { data: totals } = rows.length ? await supabase.from("reservation_totals").select("id, balance").in("id", rows.map((r) => r.id)) : { data: [] };
  const balance = new Map((totals ?? []).map((x) => [x.id, Number(x.balance)]));
  if (tab === "toSign" || tab === "active") rows.reverse(); // soonest first
  const now = new Date();

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={t("tabsLabel")} className="flex flex-wrap gap-2">
          {TABS.map((k) => (
            <Link
              key={k}
              href={`/contracts?tab=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
      {rows.length ? (
        <ReservationTable testId="contract-list" kind="contract" rows={rows.map((r) => ({ ...r, balance: balance.get(r.id) ?? 0 }))} now={now} />
      ) : q ? (
        <EmptyState icon={SearchXIcon} title={t("noResult")} />
      ) : (
        <EmptyState icon={FileSignatureIcon} title={t(`empty.${tab}`)} />
      )}
    </>
  );
}
