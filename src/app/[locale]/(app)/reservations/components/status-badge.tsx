import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";

export async function ReservationStatusBadge({ status, late, signed }: { status: string; late?: boolean; signed?: boolean }) {
  const t = await getTranslations("reservations.status");
  if (status === "on_rental") return <Badge variant={late ? "danger" : "info"}>{late ? t("late") : t("on_rental")}</Badge>;
  if (status === "reserved") return <Badge variant={signed ? "neutral" : "warning"}>{signed ? t("reserved") : t("toSign")}</Badge>;
  if (status === "returned") return <Badge variant="success">{t("returned")}</Badge>;
  return <Badge variant="neutral">{t("cancelled")}</Badge>;
}
