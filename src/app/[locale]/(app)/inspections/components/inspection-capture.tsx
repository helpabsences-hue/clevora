"use client";

import { CameraIcon, CheckIcon, CircleCheckBigIcon, ImagePlusIcon, LoaderIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CarDiagram, type DiagramMark } from "@/components/app/car-diagram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { DAMAGE_TYPES, missingViews, planPhotoImport, REQUIRED_VIEWS, VIEWS, viewOfPoint, type Damage, type DamageType, type View } from "@/lib/inspections/model";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { addDamageAction, completeInspectionAction, savePhotoAction, updateDamageAction } from "../actions";
import type { InspectionData } from "../queries";
import type { Kind } from "../schema";
import { SourceSwitch, useDefaultSource } from "./source-switch";
import { VideoCapture } from "./video-capture";

/** Resize a camera photo on the phone (JPEG): a full copy and a small one for the AI. */
async function shrink(file: Blob, maxWidth: number, quality: number): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("jpeg"))), "image/jpeg", quality));
}

export function InspectionCapture({
  agencyId,
  after,
  kind,
  inspection,
  reference,
}: {
  agencyId: string;
  /** Where to go once finished (the inspection page, or back to Démarrer / Retour). */
  after: string;
  kind: Kind;
  inspection: InspectionData;
  /** At return: the departure damages, shown in grey for comparison. */
  reference: Damage[];
}) {
  const t = useTranslations("inspection");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [uploading, setUploading] = useState<View | null>(null);
  const [pending, start] = useTransition();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [type, setType] = useState<DamageType>("scratch");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState(inspection.notes ?? "");
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const many = useRef<HTMLInputElement>(null);
  const [source, setSource] = useDefaultSource();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const target = useRef<View | null>(null);
  const done = Boolean(inspection.completedAt);
  const photos = new Map(inspection.photos.map((p) => [p.view, p]));
  const video = inspection.mode === "video";
  const missing = video ? [] : missingViews(photos.keys());
  const blocked = video ? !inspection.videoUrl : missing.length > 0;

  const takePhoto = (view: View) => {
    target.current = view;
    (source === "camera" ? input : picker).current?.click();
  };
  /** One photo for one view: shrink on the device, upload both copies, record it. */
  const sendPhoto = async (file: File, view: View) => {
    const [full, small] = await Promise.all([shrink(file, 1600, 0.82), shrink(file, 768, 0.7)]);
    const path = `${agencyId}/inspections/${inspection.id}/${view}.jpg`;
    const sb = createClient();
    const up = await Promise.all([
      sb.storage.from("agency-docs").upload(path, full, { contentType: "image/jpeg", upsert: true }),
      sb.storage.from("agency-docs").upload(path.replace(/\.jpg$/, "-s.jpg"), small, { contentType: "image/jpeg", upsert: true }),
    ]);
    if (up.some((u) => u.error)) throw new Error("upload");
    const r = await savePhotoAction(inspection.id, view, path);
    if (!r.ok) throw new Error(r.error);
  };
  const resetInputs = () => {
    for (const el of [input.current, picker.current, many.current]) if (el) el.value = "";
  };
  const upload = async (file: File | undefined) => {
    const view = target.current;
    if (!file || !view) return;
    setUploading(view);
    try {
      await sendPhoto(file, view);
      toast.success(t("photoSaved", { view: t(`views.${view}`) }));
      router.refresh();
    } catch {
      toast.error(t("photoFailed"));
    } finally {
      setUploading(null);
      resetInputs();
    }
  };
  /** Several photos at once: they fill the empty boxes in order (front, back, left, right…). */
  const uploadMany = async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/")).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!files.length) return;
    const plan = planPhotoImport(files, photos.keys());
    let sent = 0;
    for (const [file, view] of plan) {
      setUploading(view);
      setProgress({ done: sent, total: plan.length });
      try {
        await sendPhoto(file, view);
        sent++;
      } catch {
        toast.error(t("photoFailed"));
        break;
      }
    }
    setUploading(null);
    setProgress(null);
    resetInputs();
    if (sent) toast.success(t("photosImported", { count: sent }));
    if (files.length > plan.length) toast.info(t("photosExtra", { count: files.length - plan.length }));
    router.refresh();
  };

  const marks: DiagramMark[] = [
    ...(kind === "return" ? reference.filter((d) => d.confirmed).map((d) => ({ id: `ref-${d.id}`, x: d.x, y: d.y, label: "•", tone: "existing" as const, title: t("atDeparture") })) : []),
    ...inspection.damages.map((d, i) => ({ id: d.id, x: d.x, y: d.y, label: String(i + 1), tone: d.source === "ai" && !d.confirmed ? ("ai" as const) : kind === "return" ? ("new" as const) : ("plain" as const), title: t(`types.${d.type}`) })),
  ];

  const addDamage = () =>
    point &&
    start(async () => {
      const r = await addDamageAction(inspection.id, { ...point, type, view: viewOfPoint(point.x, point.y), note });
      if (!r.ok) return void toast.error(te(r.error));
      toast.success(t("damageAdded"));
      setPoint(null);
      setNote("");
      router.refresh();
    });
  const remove = (id: string) =>
    start(async () => {
      const r = await updateDamageAction(id, "remove");
      if (!r.ok) return void toast.error(te(r.error));
      router.refresh();
    });
  const finish = () =>
    start(async () => {
      const r = await completeInspectionAction(inspection.id, notes);
      if (!r.ok) return void toast.error(r.error === "photosMissing" ? t("photosMissing") : te(r.error));
      toast.success(t("completed"));
      router.push(after);
    });

  return (
    <div className="flex flex-col gap-4">
      {video ? (
        <VideoCapture agencyId={agencyId} inspectionId={inspection.id} videoUrl={inspection.videoUrl} done={done} />
      ) : (
      <>
      {/* camera (opens the phone camera directly), one file, several files */}
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden data-testid="inspection-camera" onChange={(e) => upload(e.target.files?.[0])} />
      <input ref={picker} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden data-testid="inspection-file" onChange={(e) => upload(e.target.files?.[0])} />
      <input ref={many} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden data-testid="inspection-files" onChange={(e) => uploadMany(e.target.files)} />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {t("photosTitle")}
            <span className="text-sm font-normal text-muted-foreground">{t("photosCount", { done: inspection.photos.length, total: VIEWS.length })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!done ? (
            <SourceSwitch
              value={source}
              onChange={setSource}
              disabled={uploading !== null}
              label={t("source.label")}
              camera={t("source.camera")}
              cameraHint={t("source.cameraHint")}
              files={t("source.files")}
              filesHint={t("source.filesHint")}
            />
          ) : null}
          {!done && source === "files" ? (
            <Button size="lg" variant="outline" className="h-auto min-h-12 whitespace-normal py-2" onClick={() => many.current?.click()} disabled={uploading !== null || photos.size === VIEWS.length} data-testid="import-many">
              {progress ? <LoaderIcon className="animate-spin" aria-hidden /> : <ImagePlusIcon aria-hidden />}
              {progress ? t("importing", { done: progress.done + 1, total: progress.total }) : t("importMany")}
            </Button>
          ) : null}
          {!done ? <p className="text-sm text-muted-foreground">{source === "camera" ? t("photosHint") : t("photosHintFiles")}</p> : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="inspection-photos">
            {VIEWS.map((view) => {
              const p = photos.get(view);
              const required = REQUIRED_VIEWS.includes(view);
              return (
                <li key={view}>
                  <button
                    type="button"
                    onClick={() => takePhoto(view)}
                    disabled={uploading !== null || done}
                    className={cn(
                      "relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      p ? "border-success/60" : required ? "border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10" : "border-dashed bg-muted/40 hover:bg-muted",
                    )}
                    aria-label={source === "camera" ? (p ? t("retake", { view: t(`views.${view}`) }) : t("take", { view: t(`views.${view}`) })) : t("choose", { view: t(`views.${view}`) })}
                    data-testid={`photo-${view}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private 1-hour links: never through the image optimizer */}
                    {p?.thumb ? <img src={p.thumb} alt="" className="absolute inset-0 size-full object-cover" /> : null}
                    <span className={cn("relative z-10 flex flex-col items-center gap-1 rounded-lg px-2 py-1", p && "bg-black/55 text-white")}>
                      {uploading === view ? <LoaderIcon className="size-5 animate-spin" aria-hidden /> : p ? <CheckIcon className="size-5" aria-hidden /> : source === "camera" ? <CameraIcon className="size-5" aria-hidden /> : <UploadIcon className="size-5" aria-hidden />}
                      {t(`views.${view}`)}
                    </span>
                    {required && !p ? <Badge variant="info" className="absolute end-1.5 top-1.5">{t("required")}</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("damagesTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{done ? t("damagesDone") : t("damagesHint")}</p>
          {!done && kind === "departure" && inspection.damages.some((d) => d.note?.startsWith(t("carriedStart"))) ? (
            <p className="rounded-lg bg-muted/60 p-3 text-sm" data-testid="carried-hint">
              {t("carriedHint")}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="grid items-start gap-6 md:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <CarDiagram marks={marks} onPick={done ? undefined : (x, y) => setPoint({ x, y })} label={t("diagramLabel")} testId="inspection-diagram" />
            {kind === "return" && reference.length ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block size-3 rounded-full bg-muted-foreground" aria-hidden />
                {t("legendDeparture")}
              </span>
            ) : null}
          </div>
          {inspection.damages.length ? (
            <ol className="flex flex-col divide-y rounded-xl border" data-testid="inspection-damages">
              {inspection.damages.map((d, i) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                  <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", kind === "return" ? "bg-destructive" : "bg-primary dark:bg-ring")}>{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{t(`types.${d.type}`)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {d.view ? t(`views.${d.view}`) : ""}
                      {d.note ? ` · ${d.note}` : ""}
                    </span>
                  </span>
                  {!done ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(d.id)} aria-label={t("removeDamage", { n: i + 1 })} disabled={pending}>
                      <Trash2Icon aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t("noDamage")}</p>
          )}
        </CardContent>
      </Card>

      {!done ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Field id="insp-notes" label={t("notes")}>
              <Input id="insp-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} />
            </Field>
            {missing.length ? <p className="text-sm text-muted-foreground">{t("stillMissing", { views: missing.map((v) => t(`views.${v}`)).join(", ") })}</p> : null}
            {video && blocked ? <p className="text-sm text-muted-foreground">{t("video.missing")}</p> : null}
            <Button size="lg" onClick={finish} disabled={pending || blocked} data-testid="inspection-finish">
              <CircleCheckBigIcon aria-hidden />
              {t("finish")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={point !== null} onOpenChange={(o) => !o && setPoint(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("addDamage")}</DialogTitle>
            <DialogDescription>{point ? t(`views.${viewOfPoint(point.x, point.y)}`) : ""}</DialogDescription>
          </DialogHeader>
          <ChoiceChips name="dmg-type" label={t("damageType")} value={type} onChange={(v) => setType(v as DamageType)} className="grid-cols-2 sm:grid-cols-3" options={DAMAGE_TYPES.map((d) => ({ value: d, label: t(`types.${d}`) }))} />
          <Field id="dmg-note" label={t("damageNote")}>
            <Input id="dmg-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t("damageNotePlaceholder")} />
          </Field>
          <DialogFooter>
            <Button size="lg" onClick={addDamage} disabled={pending} data-testid="damage-save">
              <CheckIcon aria-hidden />
              {t("saveDamage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
