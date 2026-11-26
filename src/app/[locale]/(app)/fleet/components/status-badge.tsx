"use client";

import { useTranslations } from "next-intl";
import { Ltr } from "@/components/app/ltr";
import { StatusPill } from "@/components/app/status-pill";
import type { VehicleStatus } from "@/lib/fleet/status";
import { formatDate } from "@/lib/format";

/** Short status word with a coloured dot; the detail goes on a small second line. */
export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const t = useTranslations("fleet.status");
  const tr = useTranslations("fleet.reasons");
  const day = (iso: string) => <Ltr>{formatDate(iso).slice(0, 5)}</Ltr>;
  switch (status.kind) {
    case "maintenance":
      return (
        <StatusPill
          tone="warning"
          label={t("maintenance")}
          detail={<>{tr(status.reason)}{status.until ? <> · {t("until")} {day(status.until)}</> : null}</>}
          testId="vehicle-status"
        />
      );
    case "on_rental":
      return <StatusPill tone="info" label={t("on_rental")} detail={<>{t("until")} <Ltr>{status.untilDay}</Ltr></>} testId="vehicle-status" />;
    case "blocked":
      return <StatusPill tone="danger" label={t("blockedShort")} detail={t("blockedDetail")} testId="vehicle-status" />;
    case "reserved_today":
      return <StatusPill tone="neutral" label={t("reservedShort")} detail={<>{t("today")} <Ltr>{status.time}</Ltr></>} testId="vehicle-status" />;
    case "sold":
      return <StatusPill tone="neutral" label={t("sold")} testId="vehicle-status" />;
    default:
      return <StatusPill tone="success" label={t("available")} testId="vehicle-status" />;
  }
}
