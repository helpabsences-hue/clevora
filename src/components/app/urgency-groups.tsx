import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { groupByUrgency, type UrgencyGroup } from "@/lib/urgency";

const HEADER_TONE: Record<string, string> = {
  late: "text-destructive",
  today: "text-foreground",
  tomorrow: "text-foreground",
  afterTomorrow: "text-foreground",
};

/**
 * Groups rows under "En retard", "Aujourd'hui", "Demain", "Après-demain",
 * then weekday names / dates — most urgent first, with a count per group.
 * Server component: pass the items and how to render each group's content.
 */
export async function UrgencyGroups<T>({
  items,
  getDate,
  render,
  now = new Date(),
  lateIfPast = true,
  lateLabel,
  testId,
}: {
  items: T[];
  getDate: (item: T) => Date | string;
  render: (items: T[], group: UrgencyGroup<T>) => ReactNode;
  now?: Date;
  lateIfPast?: boolean;
  /** Override "En retard" (e.g. "Expirées" for insurance). */
  lateLabel?: string;
  testId?: string;
}) {
  const t = await getTranslations("urgency");
  const format = await getFormatter();
  const groups = groupByUrgency(items, getDate, now, { lateIfPast });

  const label = (g: UrgencyGroup<T>) => {
    if (g.key === "late") return lateLabel ?? t("late");
    if (g.key === "today" || g.key === "tomorrow" || g.key === "afterTomorrow") return t(g.key);
    const date = new Date(`${g.day}T12:00:00Z`);
    return g.withinWeek
      ? format.dateTime(date, { weekday: "long", day: "numeric", month: "long" })
      : format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="flex flex-col gap-6" data-testid={testId}>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`urgency-${g.key}`} data-urgency={g.key}>
          <h2 id={`urgency-${g.key}`} className={cn("mb-2 flex items-center gap-2 text-base font-semibold first-letter:uppercase", HEADER_TONE[g.key] ?? "text-muted-foreground")}>
            <span className="first-letter:uppercase">{label(g)}</span>
            <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold", g.key === "late" ? "bg-danger-soft text-destructive" : "bg-muted text-muted-foreground")}>
              {g.items.length}
            </span>
          </h2>
          {render(g.items, g)}
        </section>
      ))}
    </div>
  );
}
