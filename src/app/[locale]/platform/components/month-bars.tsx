import { cn } from "@/lib/utils";

/**
 * Simple 12-month bar chart (one series: no legend). Value on hover and on the
 * latest bar; a hidden table carries the same numbers for screen readers.
 */
export function MonthBars({ title, data, format, testId }: { title: string; data: Array<{ label: string; value: number }>; format: (n: number) => string; testId?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const last = data.at(-1);
  return (
    <figure className="flex flex-col gap-2" data-testid={testId}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {last ? <bdi dir="ltr" className="text-sm font-bold tabular-nums">{format(last.value)}</bdi> : null}
      </figcaption>
      <div className="flex h-28 items-end gap-1" aria-hidden>
        {data.map((d, i) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label} : ${format(d.value)}`}>
            <div
              className={cn("w-full rounded-t-[4px] transition-colors", i === data.length - 1 ? "bg-primary dark:bg-ring" : "bg-primary/35 group-hover:bg-primary/60 dark:bg-ring/40")}
              style={{ height: d.value ? `${Math.max(4, (d.value / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden>
        <span>{data[0]?.label}</span>
        <span>{last?.label}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
