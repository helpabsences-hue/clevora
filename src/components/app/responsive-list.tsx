import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Column priority decides where a column goes when there is no room:
 *  - "primary": the card title on small screens
 *  - "high":    stays visible on the card
 *  - "low":     shown in the card body (smaller, under a label) on small screens
 */
export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  priority: "primary" | "high" | "low";
  align?: "start" | "end";
  /** Hide the header label inside cards (e.g. a status badge). */
  hideLabelInCard?: boolean;
  /** Keep the cell on one line in the table (numbers, dates, amounts). Default for end-aligned columns. */
  nowrap?: boolean;
  /** Extra classes for the table cell and header (e.g. a width). */
  className?: string;
};

export type ListGroup<T> = {
  key: string;
  label: ReactNode;
  tone?: "danger" | "warning" | "default";
  rows: T[];
};

type Props<T> = {
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** The whole row opens this page (the first cell holds the real link). */
  rowHref?: (row: T) => string;
  /** Row actions. "table": compact (icon menu); "card": big buttons. */
  actions?: (row: T, mode: "table" | "card") => ReactNode;
  caption?: string;
  testId?: string;
  rowTestId?: string;
  /** Under the table: totals, a count… */
  footer?: ReactNode;
  /** Multi-select: a box per row (first column / card corner) and a "select all" box in the header. */
  select?: { cell: (row: T) => ReactNode; all: ReactNode };
} & ({ rows: T[]; groups?: never } | { groups: ListGroup<T>[]; rows?: never });

const TONE = { danger: "text-destructive", warning: "text-warning", default: "text-foreground" } as const;

function GroupTitle({ label, count, tone = "default" }: { label: ReactNode; count: number; tone?: ListGroup<unknown>["tone"] }) {
  return (
    <span className={cn("flex items-center gap-2 text-sm font-semibold", TONE[tone ?? "default"])}>
      {label}
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold text-foreground">{count}</span>
    </span>
  );
}

/**
 * A table from 1024 px that becomes stacked cards on phones and tablets —
 * never a horizontal page scroll. Rows can be grouped by urgency.
 * Works in server and client components.
 */
export function ResponsiveList<T>(props: Props<T>) {
  const { columns, rowKey, rowHref, actions, caption, testId, rowTestId, footer, select } = props;
  const groups: ListGroup<T>[] = props.groups ?? [{ key: "all", label: null, rows: props.rows ?? [] }];
  const grouped = Boolean(props.groups);
  const primary = columns.filter((c) => c.priority === "primary");
  const high = columns.filter((c) => c.priority === "high");
  const low = columns.filter((c) => c.priority === "low");
  const span = columns.length + (actions ? 1 : 0) + (select ? 1 : 0);
  const nowrap = (c: Column<T>) => c.nowrap ?? c.align === "end";

  return (
    <div data-testid={testId}>
      {/* Laptop: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs lg:block">
        <table className="w-full text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="border-b bg-muted/50">
            <tr>
              {select ? <th scope="col" className="w-0 ps-4 pe-0 py-1">{select.all}</th> : null}
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase",
                    c.align === "end" ? "text-end" : "text-start",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
              {actions ? (
                <th scope="col" className="w-0 px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          {groups.map((g) =>
            g.rows.length ? (
              <tbody key={g.key} className="divide-y border-b last:border-b-0" data-group={grouped ? g.key : undefined}>
                {grouped ? (
                  <tr className="bg-muted/30">
                    <th scope="colgroup" colSpan={span} className="px-4 py-2 text-start">
                      <GroupTitle label={g.label} count={g.rows.length} tone={g.tone} />
                    </th>
                  </tr>
                ) : null}
                {g.rows.map((row) => (
                  <tr key={rowKey(row)} className={cn("relative align-middle transition-colors", rowHref && "hover:bg-accent/60")} data-testid={rowTestId}>
                    {select ? <td className="relative z-10 w-0 ps-4 pe-0 py-1">{select.cell(row)}</td> : null}
                    {columns.map((c, i) => (
                      <td key={c.key} className={cn("px-4 py-3", c.align === "end" ? "text-end" : "text-start", nowrap(c) ? "whitespace-nowrap" : "break-words", c.className)}>
                        {i === 0 && rowHref ? (
                          <Link href={rowHref(row)} className="font-semibold outline-none before:absolute before:inset-0 before:content-[''] focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-inset">
                            {c.cell(row)}
                          </Link>
                        ) : (
                          c.cell(row)
                        )}
                      </td>
                    ))}
                    {actions ? (
                      <td className="relative z-10 px-3 py-2 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">{actions(row, "table")}</div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            ) : null,
          )}
        </table>
        {footer ? <div className="border-t bg-muted/30 px-4 py-2.5 text-sm">{footer}</div> : null}
      </div>

      {/* Phone & tablet: cards */}
      <div className="flex flex-col gap-5 lg:hidden">
        {groups.map((g) =>
          g.rows.length ? (
            <section key={g.key} className="flex flex-col gap-2" data-group={grouped ? g.key : undefined}>
              {grouped ? <GroupTitle label={g.label} count={g.rows.length} tone={g.tone} /> : null}
              <ul className="grid gap-3 md:grid-cols-2">
                {g.rows.map((row) => {
                  const title = (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {primary.map((c) => (
                        <div key={c.key} className="min-w-0 break-words font-semibold">
                          {c.cell(row)}
                        </div>
                      ))}
                    </div>
                  );
                  return (
                    <li key={rowKey(row)} className={cn("relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs", select && "pe-14")} data-testid={rowTestId}>
                      {select ? <div className="absolute end-3 top-3">{select.cell(row)}</div> : null}
                      {rowHref ? (
                        <Link href={rowHref(row)} className="rounded-md">
                          {title}
                        </Link>
                      ) : (
                        title
                      )}
                      {high.length ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                          {high.map((c) => (
                            <div key={c.key} className="min-w-0 break-words">
                              {c.hideLabelInCard ? null : <span className="sr-only">{c.header}: </span>}
                              {c.cell(row)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {low.length ? (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {low.map((c) => (
                            <div key={c.key} className="min-w-0">
                              <dt className="text-xs text-muted-foreground">{c.header}</dt>
                              <dd className="break-words">{c.cell(row)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {actions ? <div className="flex flex-wrap gap-2 border-t pt-3">{actions(row, "card")}</div> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null,
        )}
        {footer ? <div className="rounded-xl border bg-card px-4 py-3 text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
