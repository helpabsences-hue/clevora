import { ArrowRightIcon, CarIcon, CornerDownLeftIcon, FileSignatureIcon, FolderOpenIcon, PhoneIcon, TruckIcon, type LucideIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatDate, formatTime } from "@/lib/format";
import { groupByUrgency } from "@/lib/urgency";
import { cn } from "@/lib/utils";
import type { DashboardReservation } from "../queries";

const MAX_ROWS = 8;

/**
 * "Retours à venir" / "Départs à venir" on Aujourd'hui: one card, compact rows
 * grouped by urgency. Each row: time (red when late) · client, car, contract ·
 * call + the one action that matters.
 */
export async function MovementList({
  kind,
  items,
  now,
  title,
  icon: Icon,
  empty,
}: {
  kind: "return" | "departure";
  items: DashboardReservation[];
  now: Date;
  title: string;
  icon: LucideIcon;
  empty: string;
}) {
  const t = await getTranslations("dashboard");
  const tu = await getTranslations("urgency");
  const format = await getFormatter();
  const at = (r: DashboardReservation) => (kind === "return" ? r.end_at : r.start_at);
  const shown = [...items].sort((a, b) => at(a).localeCompare(at(b))).slice(0, MAX_ROWS);
  const groups = groupByUrgency(shown, at, now);
  const groupLabel = (g: (typeof groups)[number]) => {
    if (g.key === "late") return tu("late");
    if (g.key === "today" || g.key === "tomorrow" || g.key === "afterTomorrow") return tu(g.key);
    const d = new Date(`${g.day}T12:00:00Z`);
    return format.dateTime(d, { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <section aria-labelledby={`${kind}-title`} className="@container flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs" data-testid={`dash-${kind}s`}>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className={cn("inline-flex size-9 items-center justify-center rounded-lg", kind === "return" ? "bg-warning-soft text-warning" : "bg-info-soft text-info")} aria-hidden>
          <Icon className="size-5" />
        </span>
        <h2 id={`${kind}-title`} className="flex-1 text-lg font-bold">
          {title}
        </h2>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-bold">{items.length}</span>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col">
          {groups.map((g) => (
            <div key={g.key} data-urgency={g.key}>
              <p className={cn("bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide first-letter:uppercase", g.key === "late" ? "text-destructive" : "text-muted-foreground")}>
                {groupLabel(g)}
              </p>
              <ul className="divide-y">
                {g.items.map((r) => {
                  const when = at(r);
                  const late = new Date(when) < now;
                  const place = kind === "departure" ? (r.delivery ? r.delivery_place : null) : r.return_place;
                  const main =
                    kind === "return"
                      ? { href: `/reservations/${r.id}?do=return`, label: t("return"), icon: CornerDownLeftIcon, primary: true }
                      : !r.vehicle
                        ? { href: `/reservations/${r.id}?do=car`, label: t("chooseCar"), icon: CarIcon, primary: true }
                        : r.signed_at
                        ? { href: `/reservations/${r.id}`, label: t("open"), icon: FolderOpenIcon, primary: false }
                        : { href: `/contracts/${r.id}`, label: t("sign"), icon: FileSignatureIcon, primary: false };
                  const MainIcon = main.icon;
                  return (
                    <li key={r.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 @md:grid-cols-[3.5rem_minmax(0,1fr)_auto]" data-testid={`dash-${kind}`}>
                      <span className="flex w-14 shrink-0 flex-col leading-tight">
                        <Ltr className={cn("text-base font-bold tabular-nums", late && "text-destructive")}>{formatTime(when)}</Ltr>
                        <Ltr className="text-xs text-muted-foreground">{formatDate(when).slice(0, 5)}</Ltr>
                      </span>
                      <Link href={`/reservations/${r.id}`} className="flex min-w-0 flex-1 flex-col rounded-md leading-tight hover:underline-offset-4">
                        <span className="truncate font-semibold">{r.client.full_name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {r.vehicle ? (
                            <>
                              {r.vehicle.brand_model} · <Ltr>{r.vehicle.plate}</Ltr>
                            </>
                          ) : (
                            <span className="font-medium text-warning">{t("carToChoose")}</span>
                          )}
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <Ltr>{r.contract_number}</Ltr>
                          {place ? (
                            <>
                              <span aria-hidden>·</span>
                              <TruckIcon className="size-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{place}</span>
                            </>
                          ) : null}
                        </span>
                      </Link>
                      <span className="col-start-2 flex items-center gap-1.5 @md:col-start-3">
                        {r.client.phone ? (
                          <Button variant="outline" size="icon" asChild>
                            <a href={`tel:${r.client.phone}`} aria-label={t("call", { name: r.client.full_name })} title={t("callShort")}>
                              <PhoneIcon aria-hidden />
                            </a>
                          </Button>
                        ) : null}
                        <Button size="sm" variant={main.primary ? "default" : "outline"} asChild>
                          <Link href={main.href}>
                            <MainIcon aria-hidden />
                            {main.label}
                          </Link>
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {items.length > MAX_ROWS ? (
            <Link href="/reservations" className="flex min-h-11 items-center justify-center gap-1 border-t text-sm font-semibold hover:bg-accent">
              {t("seeAll", { count: items.length })}
              <ArrowRightIcon className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
