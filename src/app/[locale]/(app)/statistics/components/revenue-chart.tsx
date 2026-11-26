"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatMoney } from "@/lib/format";
import type { Bucket } from "@/lib/stats";

/**
 * Revenue per day or per month: one series in the agency colour (no legend),
 * thin bars with rounded tops, recessive grid, partial months lighter, and a
 * tooltip with revenue · charges · net for the bar.
 */
export function RevenueChart({ buckets, labels }: { buckets: Bucket[]; labels: Record<string, string> }) {
  const t = useTranslations("statistics");
  const rtl = useLocale() === "ar";
  const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
  const data = buckets.map((b) => ({ ...b, label: labels[b.key] ?? b.key }));

  const TooltipBox = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    const b = active && payload?.[0]?.payload as (typeof data)[number] | undefined;
    if (!b) return null;
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
        <p className="mb-1 font-semibold">
          {b.label}
          {b.partial ? <span className="ms-1 text-xs font-normal text-muted-foreground">({t("partial")})</span> : null}
        </p>
        <p><span className="text-muted-foreground">{t("revenue")} : </span><bdi dir="ltr" className="font-semibold">{formatMoney(b.revenue)}</bdi></p>
        <p><span className="text-muted-foreground">{t("charges")} : </span><bdi dir="ltr">{formatMoney(b.charges)}</bdi></p>
        <p><span className="text-muted-foreground">{t("net")} : </span><bdi dir="ltr" className={b.net < 0 ? "text-destructive" : ""}>{formatMoney(b.net)}</bdi></p>
      </div>
    );
  };

  return (
    <div className="h-72 w-full [--chart-bar:var(--brand)] dark:[--chart-bar:color-mix(in_oklab,var(--brand)_55%,white)]" data-testid="revenue-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={data.length > 20 ? 2 : "20%"}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="label" reversed={rtl} tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis orientation={rtl ? "right" : "left"} tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => compact.format(v)} />
          <Tooltip content={TooltipBox} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            {data.map((b) => (
              <Cell key={b.key} fill="var(--chart-bar)" fillOpacity={b.partial ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
