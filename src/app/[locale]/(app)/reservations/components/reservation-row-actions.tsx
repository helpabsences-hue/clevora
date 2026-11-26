"use client";

import { CarIcon, CornerDownLeftIcon, DownloadIcon, EyeIcon, MessageCircleIcon, PenLineIcon, PhoneIcon, PlayIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { RowMenu, type RowMenuItem } from "@/components/app/row-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { whatsappNumber } from "@/lib/phone";

/**
 * Quick actions of a row. Réservations: the work (Voiture / Démarrer / Retour).
 * Contrats: the document only (Signer / PDF). Table: main action + "⋯" menu;
 * card: big buttons.
 */
export function ReservationRowActions({
  id,
  status,
  hasCar = true,
  signed = true,
  clientName,
  phone,
  compact,
  kind = "reservation",
}: {
  id: string;
  status: string;
  hasCar?: boolean;
  signed?: boolean;
  clientName: string;
  phone: string | null;
  compact: boolean;
  kind?: "reservation" | "contract";
}) {
  const t = useTranslations("reservations.list");
  if (kind === "contract")
    return status === "reserved" && !signed ? (
      <Button size="sm" variant="outline" asChild>
        <Link href={`/contracts/${id}`}>
          <PenLineIcon aria-hidden />
          {t("sign")}
        </Link>
      </Button>
    ) : status !== "cancelled" ? (
      <Button size="sm" variant="outline" asChild>
        <a href={`/api/contracts/${id}/pdf`} target="_blank" rel="noopener">
          <DownloadIcon aria-hidden />
          PDF
        </a>
      </Button>
    ) : null;
  const main =
    status === "reserved" && !hasCar ? (
      <Button size="sm" asChild>
        <Link href={`/reservations/${id}?do=car`}>
          <CarIcon aria-hidden />
          {t("chooseCar")}
        </Link>
      </Button>
    ) : status === "reserved" ? (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/reservations/${id}?do=start`}>
          <PlayIcon aria-hidden />
          {t("start")}
        </Link>
      </Button>
    ) : status === "on_rental" ? (
      <Button size="sm" asChild>
        <Link href={`/reservations/${id}?do=return`}>
          <CornerDownLeftIcon aria-hidden />
          {t("return")}
        </Link>
      </Button>
    ) : null;

  if (compact) {
    const items: RowMenuItem[] = [{ label: t("open"), icon: EyeIcon, href: `/reservations/${id}` }];
    if (phone) {
      items.push({ label: t("callShort"), icon: PhoneIcon, onSelect: () => (window.location.href = `tel:${phone}`) });
      items.push({ label: "WhatsApp", icon: MessageCircleIcon, onSelect: () => window.open(`https://wa.me/${whatsappNumber(phone)}`, "_blank", "noopener,noreferrer") });
    }
    return (
      <>
        {main}
        <RowMenu label={t("menu", { name: clientName })} items={items} />
      </>
    );
  }

  return (
    <>
      {phone ? (
        <Button variant="outline" size="sm" asChild>
          <a href={`tel:${phone}`} aria-label={t("call", { name: clientName })}>
            <PhoneIcon aria-hidden />
            {t("callShort")}
          </a>
        </Button>
      ) : null}
      {main}
    </>
  );
}
