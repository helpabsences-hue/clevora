import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type DiagramMark = { id: string; x: number; y: number; label: string; tone: "existing" | "new" | "ai" | "plain"; title?: string };

const TONE = {
  plain: "fill-primary stroke-card dark:fill-ring",
  existing: "fill-muted-foreground stroke-card",
  new: "fill-destructive stroke-card",
  ai: "fill-[#7c3aed] stroke-card",
} as const;

/**
 * A car seen from above (front at the top, its left side on the left), with
 * numbered damage marks. x, y of marks go from 0 to 1. With onPick, a tap adds a point.
 */
export function CarDiagram({ marks, onPick, className, label, testId }: { marks: DiagramMark[]; onPick?: (x: number, y: number) => void; className?: string; label: string; testId?: string }) {
  const pick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const box = e.currentTarget.getBoundingClientRect();
    onPick(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)));
  };
  return (
    <svg
      viewBox="0 0 200 400"
      role="img"
      aria-label={label}
      className={cn("h-auto w-full max-w-[220px] select-none", onPick && "cursor-crosshair touch-manipulation", className)}
      onClick={onPick ? pick : undefined}
      data-testid={testId}
    >
      {/* wheels */}
      {[
        [22, 82],
        [158, 82],
        [22, 262],
        [158, 262],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="20" height="56" rx="7" className="fill-foreground/70" />
      ))}
      {/* body */}
      <path d="M100 18 C150 18 168 40 170 78 L172 318 C172 360 152 384 100 384 C48 384 28 360 28 318 L30 78 C32 40 50 18 100 18 Z" className="fill-card stroke-foreground/60" strokeWidth="3" />
      {/* bonnet & bumpers */}
      <path d="M48 52 C70 38 130 38 152 52" fill="none" className="stroke-warning/70" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 356 C72 368 128 368 150 356" fill="none" className="stroke-warning/70" strokeWidth="3" strokeLinecap="round" />
      {/* windscreen, roof, rear window */}
      <path d="M52 112 C80 96 120 96 148 112 L140 150 C112 142 88 142 60 150 Z" className="fill-[#c4b5fd]/60 stroke-foreground/40" strokeWidth="2" />
      <rect x="60" y="160" width="80" height="96" rx="10" className="fill-muted stroke-foreground/30" strokeWidth="2" />
      <path d="M60 268 C88 276 112 276 140 268 L148 300 C120 312 80 312 52 300 Z" className="fill-[#c4b5fd]/60 stroke-foreground/40" strokeWidth="2" />
      {/* mirrors */}
      <rect x="14" y="128" width="16" height="10" rx="4" className="fill-foreground/50" />
      <rect x="170" y="128" width="16" height="10" rx="4" className="fill-foreground/50" />
      {/* door lines */}
      {[180, 236].map((y) => (
        <g key={y}>
          <line x1="32" y1={y} x2="52" y2={y} className="stroke-foreground/30" strokeWidth="2" />
          <line x1="148" y1={y} x2="168" y2={y} className="stroke-foreground/30" strokeWidth="2" />
        </g>
      ))}
      {marks.map((m) => (
        <g key={m.id} transform={`translate(${m.x * 200} ${m.y * 400})`}>
          {m.title ? <title>{m.title}</title> : null}
          <circle r="13" className={TONE[m.tone]} strokeWidth="3" strokeDasharray={m.tone === "ai" ? "4 3" : undefined} />
          <text textAnchor="middle" dominantBaseline="central" className="fill-white text-[13px] font-bold">
            {m.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
