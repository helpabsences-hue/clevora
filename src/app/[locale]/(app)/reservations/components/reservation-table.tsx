import { getFormatter, getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { ResponsiveList, type Column, type ListGroup } from "@/components/app/responsive-list";
import { SelectAllBox, SelectBox } from "@/components/app/selection";
import { StatusPill } from "@/components/app/status-pill";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { groupByUrgency } from "@/lib/urgency";
import type { ListedReservation } from "../queries";
import { ReservationRowActions } from "./reservation-row-actions";

type Row = ListedReservation;

/**
 * Reservations / contracts as a table (cards on phones): contract + status,
 * client, car, dates, balance, quick actions. Optional grouping by urgency.
 */
export async function ReservationTable({
  rows,
  now,
  groupBy,
  testId,
  selectable = false,
  kind = "reservation",
}: {
  rows: Row[];
  now: Date;
  /** Group by urgency of this date (returns: end, departures: start). */
  groupBy?: "start" | "end";
  testId?: string;
  /** Tick boxes for bulk actions (needs a SelectionProvider around the page). */
  selectable?: boolean;
  /** Réservations: rows open the reservation (the work). Contrats: the document. */
  kind?: "reservation" | "contract";
}) {
  const t = await getTranslations("reservations");
  const tu = await getTranslations("urgency");
  const format = await getFormatter();

  const status = (r: Row) => {
    const late = r.status === "on_rental" && new Date(r.end_at) < now;
    if (r.status === "on_rental") return <StatusPill tone={late ? "danger" : "info"} label={late ? t("status.late") : t("status.on_rental")} />;
    if (r.status === "reserved") return <StatusPill tone={r.signed_at ? "neutral" : "warning"} label={r.signed_at ? t("status.reserved") : t("status.toSign")} />;
    if (r.status === "returned") return <StatusPill tone="success" label={t("status.returned")} />;
    return <StatusPill tone="neutral" label={t("status.cancelled")} />;
  };

  const columns: Column<Row>[] = [
    {
      key: "contract",
      header: t("list.contract"),
      priority: "primary",
      className: "lg:w-36",
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <Ltr className="font-bold">{r.contract_number}</Ltr>
          <span className="font-normal">{status(r)}</span>
        </span>
      ),
    },
    {
      key: "client",
      header: t("list.client"),
      priority: "primary",
      cell: (r) => (
        <span className="flex flex-col leading-tight">
          <span className="font-semibold">{r.client.full_name}</span>
          {r.client.phone ? <Ltr className="text-xs font-normal text-muted-foreground">{formatPhone(r.client.phone)}</Ltr> : null}
        </span>
      ),
    },
    {
      key: "car",
      header: t("list.car"),
      priority: "high",
      cell: (r) =>
        r.vehicle ? (
          <span className="flex flex-col leading-tight">
            <span>{r.vehicle.brand_model}</span>
            <Ltr className="text-xs text-muted-foreground">{r.vehicle.plate}</Ltr>
          </span>
        ) : (
          <StatusPill tone={r.status === "cancelled" ? "neutral" : "warning"} label={t("list.carToChoose")} />
        ),
    },
    {
      key: "dates",
      header: t("list.dates"),
      priority: "high",
      nowrap: true,
      cell: (r) => (
        <span className="flex flex-col text-sm leading-tight">
          <span><Ltr>{formatDateTime(r.start_at)}</Ltr></span>
          <span className="text-muted-foreground">→ <Ltr>{formatDateTime(r.actual_return_at ?? r.end_at)}</Ltr></span>
          {r.delivery && r.delivery_place ? <span className="max-w-56 truncate text-xs text-muted-foreground">{t("list.delivery", { place: r.delivery_place })}</span> : null}
        </span>
      ),
    },
    {
      key: "balance",
      header: t("list.balance"),
      priority: "low",
      align: "end",
      cell: (r) =>
        r.balance > 0 && r.status !== "cancelled" ? (
          <Ltr className="font-semibold text-warning">{formatMoney(r.balance)}</Ltr>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const common = {
    columns,
    rowKey: (r: Row) => r.id,
    rowHref: (r: Row) => (kind === "contract" ? `/contracts/${r.id}` : `/reservations/${r.id}`),
    rowTestId: "reservation-row",
    select: selectable
      ? {
          cell: (r: Row) => <SelectBox id={r.id} label={t("bulk.select", { contract: r.contract_number, client: r.client.full_name })} />,
          all: <SelectAllBox ids={rows.map((r) => r.id)} label={t("bulk.selectAll")} />,
        }
      : undefined,
    testId,
    caption: t("title"),
    actions: (r: Row, mode: "table" | "card") => (
      <ReservationRowActions id={r.id} status={r.status} hasCar={Boolean(r.vehicle)} signed={Boolean(r.signed_at)} clientName={r.client.full_name} phone={r.client.phone} compact={mode === "table"} kind={kind} />
    ),
  };

  if (!groupBy) return <ResponsiveList {...common} rows={rows} />;

  const groups: ListGroup<Row>[] = groupByUrgency(rows, (r) => (groupBy === "end" ? r.end_at : r.start_at), now).map((g) => {
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
  return <ResponsiveList {...common} groups={groups} />;
}
