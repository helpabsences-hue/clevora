import { CameraIcon, ClipboardCheckIcon, CornerDownLeftIcon, PlayIcon, SearchXIcon, SettingsIcon, VideoIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column, type ListGroup } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { groupByUrgency } from "@/lib/urgency";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("inspections") };
}

type Done = { completed: boolean; started: boolean };
type Row = {
  id: string;
  contract_number: string;
  status: string;
  start_at: string;
  end_at: string;
  actual_return_at: string | null;
  vehicle: { plate: string; brand_model: string } | null;
  client: { full_name: string } | null;
  departure: Done;
  ret: Done;
};

/**
 * Inspection, its own section: which cars to inspect now (departures, returns),
 * most urgent first, then the last finished ones.
 */
export default async function InspectionsPage({ searchParams }: PageProps<"/[locale]/inspections">) {
  const { agency } = await requireAgency();
  const t = await getTranslations("inspection");
  const tl = await getTranslations("inspection.list");
  const tu = await getTranslations("urgency");
  const format = await getFormatter();

  if (!agency.inspection.enabled) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          icon={ClipboardCheckIcon}
          title={tl("off")}
          description={agency.role === "admin" ? tl("offAdmin") : tl("offStaff")}
          action={
            agency.role === "admin" ? (
              <Button size="lg" asChild>
                <Link href="/settings?section=inspection">
                  <SettingsIcon aria-hidden />
                  {tl("turnOn")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      </>
    );
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();
  let ids: string[] | null = null;
  if (q.length >= 2) {
    const { data } = await supabase.rpc("search_reservation_ids", { p_agency: agency.id, p_q: q });
    ids = (data ?? []) as unknown as string[];
  }
  const now = new Date();
  const since = new Date(now.getTime() - 45 * 86_400_000).toISOString();
  let query = supabase
    .from("reservations")
    .select(
      "id, contract_number, status, start_at, end_at, actual_return_at, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name), inspections!inspections_agency_id_reservation_id_fkey(kind, completed_at)",
    )
    .eq("agency_id", agency.id)
    .neq("status", "cancelled")
    .or(`status.in.(reserved,on_rental),actual_return_at.gte.${since}`)
    .order("start_at")
    .limit(500);
  if (ids) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await query;

  const rows: Row[] = (data ?? []).map((r) => {
    const ins = (r.inspections ?? []) as Array<{ kind: string; completed_at: string | null }>;
    const of = (kind: string): Done => {
      const i = ins.find((x) => x.kind === kind);
      return { started: Boolean(i), completed: Boolean(i?.completed_at) };
    };
    return { ...(r as unknown as Omit<Row, "departure" | "ret">), departure: of("departure"), ret: of("return") };
  });
  // Departures: a car is chosen and the departure is not documented yet.
  const departures = rows.filter((r) => r.status === "reserved" && r.vehicle && !r.departure.completed);
  // Returns: the car is out (or just came back) and the return is not documented yet.
  // (a car already back only if its departure was inspected: older rentals stay out of the way).
  const returns = rows.filter((r) => !r.ret.completed && (r.status === "on_rental" || (r.status === "returned" && r.departure.started)));
  const finished = rows
    .filter((r) => r.status === "returned" && r.ret.completed)
    .sort((a, b) => (b.actual_return_at ?? b.end_at).localeCompare(a.actual_return_at ?? a.end_at))
    .slice(0, 30);

  const state = (d: Done, label: string) => (
    <StatusPill tone={d.completed ? "success" : d.started ? "info" : "warning"} label={`${label} · ${d.completed ? t("done") : d.started ? t("inProgress") : t("toDo")}`} />
  );

  const columns: Column<Row>[] = [
    {
      key: "car",
      header: tl("car"),
      priority: "primary",
      cell: (r) => (
        <span className="flex flex-col leading-tight">
          <span className="font-semibold">{r.vehicle?.brand_model ?? "—"}</span>
          {r.vehicle ? <Ltr className="text-xs font-normal text-muted-foreground">{r.vehicle.plate}</Ltr> : null}
        </span>
      ),
    },
    {
      key: "client",
      header: tl("client"),
      priority: "primary",
      cell: (r) => (
        <span className="flex flex-col leading-tight">
          <span>{r.client?.full_name}</span>
          <Ltr className="text-xs text-muted-foreground">{r.contract_number}</Ltr>
        </span>
      ),
    },
    {
      key: "when",
      header: tl("when"),
      priority: "high",
      nowrap: true,
      cell: (r) => (
        <span className="flex flex-col text-sm leading-tight">
          <Ltr>{formatDateTime(r.start_at)}</Ltr>
          <span className="text-muted-foreground">→ <Ltr>{formatDateTime(r.actual_return_at ?? r.end_at)}</Ltr></span>
        </span>
      ),
    },
    {
      key: "state",
      header: tl("state"),
      priority: "high",
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {state(r.departure, t("departure"))}
          {r.status !== "reserved" ? state(r.ret, t("return")) : null}
        </span>
      ),
    },
  ];

  const action = (r: Row) => {
    const kind = r.status === "reserved" ? "departure" : r.ret.completed ? null : "return";
    if (!kind)
      return (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/inspections/${r.id}`}>{tl("see")}</Link>
        </Button>
      );
    const Icon = agency.inspection.mode === "video" ? VideoIcon : kind === "departure" ? PlayIcon : CornerDownLeftIcon;
    return (
      <Button size="sm" asChild>
        <Link href={`/inspections/${r.id}/${kind}`}>
          <Icon aria-hidden />
          {kind === "departure" ? tl("doDeparture") : tl("doReturn")}
        </Link>
      </Button>
    );
  };

  const grouped = (list: Row[], date: (r: Row) => string): ListGroup<Row>[] =>
    groupByUrgency(list, date, now).map((g) => {
      let label: string;
      if (g.key === "late") label = tu("late");
      else if (g.key === "today" || g.key === "tomorrow" || g.key === "afterTomorrow") label = tu(g.key);
      else {
        const d = new Date(`${g.day}T12:00:00Z`);
        label = g.withinWeek ? format.dateTime(d, { weekday: "long", day: "numeric", month: "long" }) : format.dateTime(d, { day: "2-digit", month: "2-digit", year: "numeric" });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      return { key: g.key, label, tone: g.key === "late" ? "danger" : "default", rows: g.items };
    });

  const common = {
    columns,
    rowKey: (r: Row) => r.id,
    rowHref: (r: Row) => `/inspections/${r.id}`,
    rowTestId: "inspection-row",
    caption: t("title"),
    actions: (r: Row) => action(r),
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={
          <span className="inline-flex items-center gap-1">
            {agency.inspection.mode === "video" ? <VideoIcon className="size-4" aria-hidden /> : <CameraIcon className="size-4" aria-hidden />}
            {agency.inspection.mode === "video" ? tl("modeVideo") : tl("modePhotos")}
          </span>
        }
      />
      <div className="mb-4">
        <SearchBar placeholder={tl("search")} />
      </div>
      {!departures.length && !returns.length && !finished.length ? (
        q ? <EmptyState icon={SearchXIcon} title={tl("noResult")} /> : <EmptyState icon={ClipboardCheckIcon} title={tl("empty")} description={tl("emptyBody")} />
      ) : (
        <div className="flex flex-col gap-8">
          {returns.length ? (
            <section aria-labelledby="ins-returns" data-testid="inspections-returns">
              <h2 id="ins-returns" className="mb-3 text-xl font-bold">{tl("returns")}</h2>
              <ResponsiveList {...common} groups={grouped(returns, (r) => r.end_at)} />
            </section>
          ) : null}
          {departures.length ? (
            <section aria-labelledby="ins-departures" data-testid="inspections-departures">
              <h2 id="ins-departures" className="mb-3 text-xl font-bold">{tl("departures")}</h2>
              <ResponsiveList {...common} groups={grouped(departures, (r) => r.start_at)} />
            </section>
          ) : null}
          {finished.length ? (
            <section aria-labelledby="ins-finished" data-testid="inspections-finished">
              <h2 id="ins-finished" className="mb-3 text-xl font-bold">{tl("finished")}</h2>
              <ResponsiveList {...common} rows={finished} />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
