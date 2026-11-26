"use client";

import { FileDownIcon, LanguagesIcon, LoaderIcon, MessageCircleIcon, PrinterIcon, Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { whatsappNumber } from "@/lib/phone";

/**
 * État des lieux PDF: print, download, Arabic labels, and share the FILE itself
 * (phone share sheet → WhatsApp, e-mail…). A WhatsApp link with a short text too.
 */
export function ReportShare({ id, filename, clientPhone, message }: { id: string; filename: string; clientPhone: string | null; message: string }) {
  const t = useTranslations("inspection.report");
  const [sharing, setSharing] = useState(false);
  const pdf = `/api/inspections/${id}/pdf`;

  const share = async () => {
    setSharing(true);
    try {
      const res = await fetch(pdf);
      if (!res.ok) throw new Error("pdf");
      const file = new File([await res.blob()], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename, text: message });
      } else {
        // Computers: no share sheet, so save the file (then attach it where needed).
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.info(t("downloaded"));
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.error(t("failed"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Card data-testid="inspection-report">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="lg" onClick={share} disabled={sharing} data-testid="report-share">
          {sharing ? <LoaderIcon className="animate-spin" aria-hidden /> : <Share2Icon aria-hidden />}
          {t("share")}
        </Button>
        <Button size="lg" variant="outline" asChild>
          <a href={pdf} target="_blank" rel="noopener" data-testid="report-pdf">
            <PrinterIcon aria-hidden />
            {t("print")}
          </a>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <a href={`${pdf}?download=1`}>
            <FileDownIcon aria-hidden />
            {t("download")}
          </a>
        </Button>
        <Button size="lg" variant="ghost" asChild>
          <a href={`${pdf}?lang=ar`} target="_blank" rel="noopener">
            <LanguagesIcon aria-hidden />
            {t("arabic")}
          </a>
        </Button>
        {clientPhone ? (
          <Button size="lg" variant="ghost" asChild>
            <a href={`https://wa.me/${whatsappNumber(clientPhone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" data-testid="report-whatsapp">
              <MessageCircleIcon aria-hidden />
              {t("whatsapp")}
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
