"use client";

import { CheckCircle2Icon, DownloadIcon, FileSpreadsheetIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Ltr } from "@/components/app/ltr";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { parseImportRows, TEMPLATE_EXAMPLE, TEMPLATE_HEADERS, type CellValue, type ImportField, type ParsedRow } from "@/lib/fleet/import";
import { formatMoney, plateNorm } from "@/lib/format";
import { existingPlatesAction, importVehiclesAction, type ImportResult } from "../actions";

type Preview = { fileName: string; rows: ParsedRow[]; missing: ImportField[]; existing: Set<string> };

async function readRows(file: File): Promise<CellValue[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    return parsed.data;
  }
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(file)) as CellValue[][];
}

/** Import cars from Excel or CSV: auto-mapped columns, preview with errors, only valid rows saved. */
export function ImportDialog() {
  const t = useTranslations("fleet.import");
  const tf = useTranslations("fleet.form");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const { writable } = useAgency();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [readError, setReadError] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setReadError(false);
    if (input.current) input.current.value = "";
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setReadError(false);
    startTransition(async () => {
      try {
        const rows = await readRows(file);
        const parsed = parseImportRows(rows);
        const existing = await existingPlatesAction();
        setPreview({ fileName: file.name, rows: parsed.rows, missing: parsed.missing, existing: new Set(existing.ok ? existing.data : []) });
      } catch {
        setReadError(true);
        setPreview(null);
      }
    });
  };

  const downloadTemplate = async () => {
    const writeXlsxFile = (await import("write-excel-file/browser")).default;
    await writeXlsxFile([
      TEMPLATE_HEADERS.map((h) => ({ value: h, fontWeight: "bold" as const })),
      TEMPLATE_EXAMPLE.map((v) => ({ value: v })),
    ]).toFile("modele-parc-auto.xlsx");
  };

  const valid = preview?.rows.filter((r) => r.data) ?? [];
  const invalid = preview?.rows.filter((r) => !r.data) ?? [];

  const save = () =>
    startTransition(async () => {
      const res = await importVehiclesAction(valid.map((r) => r.data!));
      if (!res.ok) return void toast.error(te(res.error));
      setResult(res.data);
      setPreview(null);
      toast.success(t("done", { created: res.data.created, updated: res.data.updated }));
    });

  const errorLabel = (e: string) => {
    const [key, field] = e.split(":");
    return field ? t(`errors.${key}`, { field: t(`fields.${field}`) }) : t.has(`errors.${key}`) ? t(`errors.${key}`) : e;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" disabled={!writable}>
          <UploadIcon aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc("close")} className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              id="import-file"
              data-testid="import-file"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button type="button" size="lg" onClick={() => input.current?.click()} disabled={pending}>
              <FileSpreadsheetIcon aria-hidden />
              {preview ? t("otherFile") : t("chooseFile")}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={downloadTemplate}>
              <DownloadIcon aria-hidden />
              {t("template")}
            </Button>
          </div>

          {readError ? <Alert variant="danger">{t("readError")}</Alert> : null}

          {result ? (
            <Alert variant={result.failed.length ? "warning" : "success"} data-testid="import-result">
              <CheckCircle2Icon aria-hidden />
              <div className="flex flex-col gap-1">
                <strong>{t("done", { created: result.created, updated: result.updated })}</strong>
                {result.failed.map((f) => (
                  <span key={f.plate}>
                    <Ltr>{f.plate}</Ltr> : {te.has(f.error) ? te(f.error) : f.error}
                  </span>
                ))}
              </div>
            </Alert>
          ) : null}

          {preview ? (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{preview.fileName}</span> ·{" "}
                {t("summary", { valid: valid.length, invalid: invalid.length })}
              </p>
              {preview.missing.length ? (
                <Alert variant="danger">
                  <TriangleAlertIcon aria-hidden />
                  <span>{t("missingColumns", { columns: preview.missing.map((f) => t(`fields.${f}`)).join(", ") })}</span>
                </Alert>
              ) : null}
              <ul className="flex max-h-[45dvh] flex-col divide-y overflow-y-auto rounded-xl border" data-testid="import-preview">
                {[...invalid, ...valid].map((r) => {
                  const plate = r.data?.plate ?? r.raw.plate;
                  const exists = r.data ? preview.existing.has(plateNorm(r.data.plate)) : false;
                  return (
                    <li key={r.line} className="flex flex-col gap-1 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t("line", { line: r.line })}</span>
                        <span className="font-semibold">
                          <Ltr>{plate || "—"}</Ltr> · {r.data?.brand_model ?? r.raw.brand_model}
                        </span>
                        {r.data ? (
                          <Badge variant={exists ? "info" : "success"}>{exists ? t("willUpdate") : t("willCreate")}</Badge>
                        ) : (
                          <Badge variant="danger">{t("ignored")}</Badge>
                        )}
                        {r.data ? (
                          <span className="text-muted-foreground">
                            <Ltr>{formatMoney(r.data.daily_rate)}</Ltr> · {tf("perDay")}
                          </span>
                        ) : null}
                      </div>
                      {r.errors.length ? <p className="text-destructive">{r.errors.map(errorLabel).join(" · ")}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>

        {preview && valid.length && !preview.missing.length ? (
          <DialogFooter>
            <Button type="button" size="lg" onClick={save} disabled={pending}>
              <UploadIcon aria-hidden />
              {t("submit", { count: valid.length })}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
