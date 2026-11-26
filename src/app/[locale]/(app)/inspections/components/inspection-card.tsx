import { ArrowLeftRightIcon, CameraIcon, CarFrontIcon, CircleCheckBigIcon, LightbulbIcon, SparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CarDiagram, type DiagramMark } from "@/components/app/car-diagram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { visionConfigured } from "@/lib/ai/vision";
import { newDamages, VIEWS } from "@/lib/inspections/model";
import { cn } from "@/lib/utils";
import type { InspectionData } from "../queries";
import type { Kind } from "../schema";
import { AiCompareButton, ReviewSuggestion } from "./ai-compare";

/** « Inspection départ et retour » of one rental (Inspection section). */
export async function InspectionCard({ reservationId, status, inspections }: { reservationId: string; status: string; inspections: Record<Kind, InspectionData | null> }) {
  const t = await getTranslations("inspection");
  const dep = inspections.departure;
  const ret = inspections.return;
  const fresh = dep && ret ? newDamages(dep.damages, ret.damages) : [];
  const suggestions = ret?.damages.filter((d) => d.source === "ai" && !d.confirmed) ?? [];
  const video = dep?.mode === "video" || ret?.mode === "video";
  const canCompare = Boolean(!video && dep?.completedAt && ret?.photos.length && visionConfigured());
  const numbering = new Map((ret?.damages ?? []).map((d, i) => [d.id, i + 1]));

  const side = (kind: Kind, data: InspectionData | null) => {
    const marks: DiagramMark[] = (data?.damages ?? []).map((d, i) => ({
      id: d.id,
      x: d.x,
      y: d.y,
      label: String(i + 1),
      tone: d.source === "ai" && !d.confirmed ? "ai" : kind === "return" && fresh.some((f) => f.id === d.id) ? "new" : "existing",
      title: d.note ?? t(`types.${d.type}`),
    }));
    const allowed = kind === "departure" ? status !== "cancelled" : status === "on_rental" || status === "returned";
    return (
      <div className={cn("flex min-w-0 flex-col items-center gap-2 rounded-xl border p-2 sm:p-3", kind === "return" && ret?.completedAt && "border-[#7c3aed]/40")} data-testid={`inspection-${kind}`}>
        <span className="self-start font-semibold">{kind === "departure" ? t("departure") : t("return")}</span>
        <CarDiagram marks={marks} label={kind === "departure" ? t("departure") : t("return")} className="max-w-[160px]" />
        {data?.completedAt ? (
          <Badge variant="success" className="max-w-full whitespace-normal text-center">
            <CircleCheckBigIcon aria-hidden />
            {data.mode === "video" ? t("documentedVideo") : t("documented", { count: data.photos.length })}
          </Badge>
        ) : (
          <Badge variant="neutral">{data ? t("inProgress") : t("toDo")}</Badge>
        )}
        {allowed ? (
          <Button size="sm" variant={data?.completedAt ? "outline" : "default"} asChild className="h-auto min-h-11 w-full whitespace-normal py-2 text-center">
            <Link href={`/inspections/${reservationId}/${kind}`}>
              <CameraIcon aria-hidden />
              {data?.completedAt ? t("open") : kind === "departure" ? t("startDeparture") : t("startReturn")}
            </Link>
          </Button>
        ) : (
          <span className="text-center text-xs text-muted-foreground">{t("returnLater")}</span>
        )}
      </div>
    );
  };

  return (
    <Card data-testid="inspection-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CarFrontIcon className="size-5 text-muted-foreground" aria-hidden />
          {t("cardTitle")}
        </CardTitle>
        {canCompare ? <AiCompareButton reservationId={reservationId} again={ret?.aiStatus === "done"} /> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2">
          {side("departure", dep)}
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted sm:size-9" aria-hidden>
            <ArrowLeftRightIcon className="size-4" />
          </span>
          {side("return", ret)}
        </div>

        {suggestions.length ? (
          <section aria-labelledby="ai-sugg" className="flex flex-col gap-2 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-3" data-testid="ai-suggestions">
            <h3 id="ai-sugg" className="flex items-center gap-2 text-sm font-semibold">
              <SparklesIcon className="size-4 text-[#7c3aed]" aria-hidden />
              {t("ai.suggestionsTitle", { count: suggestions.length })}
            </h3>
            <ul className="flex flex-col divide-y">
              {suggestions.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-bold text-white">{numbering.get(d.id)}</span>
                    <span>
                      <span className="font-medium">{t(`types.${d.type}`)}</span>
                      {d.view ? ` · ${t(`views.${d.view}`)}` : ""}
                      {d.note ? <span className="block text-xs text-muted-foreground">{d.note}</span> : null}
                    </span>
                  </span>
                  <ReviewSuggestion id={d.id} n={numbering.get(d.id) ?? 0} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {dep?.completedAt && ret?.completedAt ? (
          <div className="flex flex-col gap-2 rounded-xl border p-3" data-testid="inspection-result">
            <p className="flex items-center gap-2 font-semibold">
              <CircleCheckBigIcon className={cn("size-5", fresh.length ? "text-destructive" : "text-success")} aria-hidden />
              {fresh.length ? t("newDamages", { count: fresh.length }) : t("noNewDamage")}
            </p>
            {fresh.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {fresh.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">{numbering.get(d.id)}</span>
                    {t(`types.${d.type}`)}
                    {d.view ? ` · ${t(`views.${d.view}`)}` : ""}
                    {d.note ? <span className="text-muted-foreground">· {d.note}</span> : null}
                    {d.source === "ai" ? <Badge variant="neutral">IA</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LightbulbIcon className="size-4" aria-hidden />
              {t("tip")}
            </p>
          </div>
        ) : null}

        {video && (dep?.videoUrl || ret?.videoUrl) ? (
          <section aria-labelledby="ins-videos" className="flex flex-col gap-2" data-testid="inspection-videos">
            <h3 id="ins-videos" className="font-semibold">{t("videosSideBySide")}</h3>
            <p className="text-sm text-muted-foreground">{t("videoNoAi")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[dep, ret].map((d, i) => (
                <figure key={i} className="flex min-w-0 flex-col gap-1">
                  <figcaption className="text-sm font-medium">{i === 0 ? t("departure") : t("return")}</figcaption>
                  {d?.videoUrl ? (
                    <video src={d.videoUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg border bg-black">
                      <track kind="captions" />
                    </video>
                  ) : (
                    <span className="flex aspect-video items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">{t("noVideo")}</span>
                  )}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {!video && dep && ret ? (
          <details className="rounded-xl border p-3">
            <summary className="min-h-11 cursor-pointer content-center font-medium">{t("photosSideBySide")}</summary>
            <ul className="mt-2 flex flex-col gap-3">
              {VIEWS.filter((v) => dep.photos.some((p) => p.view === v) || ret.photos.some((p) => p.view === v)).map((v) => {
                const a = dep.photos.find((p) => p.view === v);
                const b = ret.photos.find((p) => p.view === v);
                return (
                  <li key={v}>
                    <p className="mb-1 text-sm font-medium">{t(`views.${v}`)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[a, b].map((p, i) =>
                        p?.url ? (
                          <a key={i} href={p.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border">
                            {/* eslint-disable-next-line @next/next/no-img-element -- private 1-hour links */}
                            <img src={p.thumb ?? p.url} alt={`${t(`views.${v}`)} · ${i === 0 ? t("departure") : t("return")}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                          </a>
                        ) : (
                          <span key={i} className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                            {t("noPhoto")}
                          </span>
                        ),
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
