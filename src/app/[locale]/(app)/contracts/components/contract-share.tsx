"use client";

import { DownloadIcon, LanguagesIcon, MessageCircleIcon, PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { whatsappNumber } from "@/lib/phone";

/** PDF (print / download / with Arabic labels) and WhatsApp message to the client. */
export function ContractShare({
  id,
  contractNumber,
  clientName,
  clientPhone,
  agencyName,
  car,
  start,
  end,
  balance,
}: {
  id: string;
  contractNumber: string;
  clientName: string;
  clientPhone: string | null;
  agencyName: string;
  car: string;
  start: string;
  end: string;
  balance: string;
}) {
  const t = useTranslations("contracts.share");
  const pdf = `/api/contracts/${id}/pdf`;
  const message = t("whatsappMessage", { name: clientName, agency: agencyName, number: contractNumber, car, start, end, balance });
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <a href={pdf} target="_blank" rel="noopener" data-testid="contract-pdf">
          <PrinterIcon aria-hidden />
          {t("print")}
        </a>
      </Button>
      <Button variant="outline" asChild>
        <a href={`${pdf}?download=1`}>
          <DownloadIcon aria-hidden />
          {t("download")}
        </a>
      </Button>
      <Button variant="ghost" asChild>
        <a href={`${pdf}?lang=ar`} target="_blank" rel="noopener">
          <LanguagesIcon aria-hidden />
          {t("arabic")}
        </a>
      </Button>
      {clientPhone ? (
        <Button variant="ghost" asChild>
          <a href={`https://wa.me/${whatsappNumber(clientPhone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" data-testid="contract-whatsapp">
            <MessageCircleIcon aria-hidden />
            {t("whatsapp")}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
