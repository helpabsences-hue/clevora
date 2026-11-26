"use client";

import { FileSpreadsheetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Downloads rows as an .xlsx file (built in the browser, library loaded on click). */
export function ExcelExport({ fileName, header, rows, label }: { fileName: string; header: string[]; rows: Array<Array<string | number | null>>; label: string }) {
  const download = async () => {
    const writeXlsxFile = (await import("write-excel-file/browser")).default;
    await writeXlsxFile([
      header.map((h) => ({ value: h, fontWeight: "bold" as const })),
      ...rows.map((r) => r.map((v) => ({ value: v ?? "" }))),
    ]).toFile(fileName);
  };
  return (
    <Button variant="outline" size="lg" onClick={download}>
      <FileSpreadsheetIcon aria-hidden />
      {label}
    </Button>
  );
}
