"use client";

import { CameraIcon, CheckIcon, ImageIcon, LoaderIcon, ScanLineIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Ltr } from "@/components/app/ltr";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { nationalityName, type MrzResult } from "@/lib/ocr/mrz";
import { preloadScanner, scanIdDocument } from "@/lib/ocr/scan";

export type ScannedId = {
  id_type: "cin" | "passport";
  id_number: string;
  full_name: string;
  nationality: string;
  birth_date: string;
  id_expires_on: string;
};

export function toScannedId(r: MrzResult): ScannedId {
  return {
    id_type: r.idType,
    id_number: r.idNumber,
    full_name: r.fullName,
    nationality: nationalityName(r.nationality),
    birth_date: r.birthDate ?? "",
    id_expires_on: r.expiryDate ?? "",
  };
}

/**
 * "Scanner la pièce": photo of the back of the CIN or the passport photo page →
 * name, number, nationality, dates. Read on the phone itself (nothing is uploaded).
 */
export function ScanIdButton({ onResult, className }: { onResult: (data: ScannedId) => void; className?: string }) {
  const t = useTranslations("scan");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScannedId | null>(null);
  const [failed, setFailed] = useState<"unreadable" | "error" | null>(null);
  const [partial, setPartial] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResult(null);
    setFailed(null);
    setPartial(false);
    setProgress(0);
  };
  const read = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setBusy(true);
    try {
      const r = await scanIdDocument(file, setProgress);
      if (!r) setFailed("unreadable");
      else {
        setResult(toScannedId(r));
        setPartial(!r.valid);
      }
    } catch {
      setFailed("error");
    } finally {
      setBusy(false);
      if (camera.current) camera.current.value = "";
      if (gallery.current) gallery.current.value = "";
    }
  };
  const rows: Array<[string, string | null]> = result
    ? [
        [t("fullName"), result.full_name],
        [result.id_type === "cin" ? t("cin") : t("passport"), result.id_number],
        [t("nationality"), result.nationality],
        [t("birthDate"), result.birth_date ? formatDate(result.birth_date) : null],
        [t("expires"), result.id_expires_on ? formatDate(result.id_expires_on) : null],
      ]
    : [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={className}
        onClick={() => {
          reset();
          setOpen(true);
          preloadScanner();
        }}
        data-testid="scan-id"
      >
        <ScanLineIcon aria-hidden />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent closeLabel={t("close")} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLineIcon className="size-5 text-primary dark:text-foreground" aria-hidden />
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("howTo")}</DialogDescription>
          </DialogHeader>

          {/* Example of what to photograph: the 3 lines with <<< */}
          <div className="rounded-xl border-2 border-dashed border-primary/40 bg-muted/40 p-3 font-mono text-[11px] leading-snug text-muted-foreground sm:text-xs" aria-hidden>
            <p>IDMAR<span className="text-foreground">Z12345678</span>9<span className="text-foreground">AB123456</span>{"<<<<<<<"}</p>
            <p>9003152M3101012MAR{"<<<<<<<<<<<"}0</p>
            <p className="text-foreground">BENNANI{"<<"}YASSINE{"<<<<<<<<<<<<<<"}</p>
          </div>
          <p className="text-sm text-muted-foreground">{t("privacy")}</p>

          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => read(e.target.files?.[0])} />
          <input ref={gallery} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden data-testid="scan-file" onChange={(e) => read(e.target.files?.[0])} />

          {busy ? (
            <div className="flex flex-col gap-2" role="status" aria-live="polite">
              <span className="flex items-center gap-2 text-sm font-medium">
                <LoaderIcon className="size-4 animate-spin" aria-hidden />
                {progress < 0.5 ? t("loading") : t("reading")}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] dark:bg-ring" style={{ width: `${Math.round(Math.max(progress, 0.05) * 100)}%` }} />
              </div>
            </div>
          ) : null}

          {failed ? (
            <Alert variant="warning" data-testid="scan-failed">
              <TriangleAlertIcon aria-hidden />
              {failed === "unreadable" ? t("unreadable") : t("error")}
            </Alert>
          ) : null}

          {result ? (
            <div className="flex flex-col gap-2" data-testid="scan-result">
              {partial ? (
                <Alert variant="warning">
                  <TriangleAlertIcon aria-hidden />
                  {t("partial")}
                </Alert>
              ) : null}
              <dl className="divide-y rounded-xl border">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="flex items-center gap-2 text-end font-semibold">
                      {value ? <Ltr>{value}</Ltr> : <span className="font-normal text-muted-foreground">—</span>}
                      {value ? <CheckIcon className="size-4 text-success" aria-hidden /> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {result ? (
              <>
                <Button type="button" variant="outline" onClick={() => camera.current?.click()} disabled={busy}>
                  <CameraIcon aria-hidden />
                  {t("again")}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => {
                    onResult(result);
                    setOpen(false);
                  }}
                  data-testid="scan-use"
                >
                  <CheckIcon aria-hidden />
                  {t("use")}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => gallery.current?.click()} disabled={busy}>
                  <ImageIcon aria-hidden />
                  {t("choose")}
                </Button>
                <Button type="button" size="lg" onClick={() => camera.current?.click()} disabled={busy}>
                  <CameraIcon aria-hidden />
                  {t("photo")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
