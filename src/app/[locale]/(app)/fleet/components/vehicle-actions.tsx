"use client";

import { EyeIcon, PencilIcon, PlayCircleIcon, WrenchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Can, useAgency } from "@/components/app/agency-context";
import { RowMenu, type RowMenuItem } from "@/components/app/row-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { endMaintenanceAction } from "../actions";
import { MaintenanceSheet } from "./maintenance-sheet";

/**
 * Row / page actions: Maintenance or Remettre en service (staff too), Modifier (admins).
 * `compact`: one "⋯" menu for table rows.
 */
export function VehicleActions({
  vehicleId,
  vehicleLabel,
  openMaintenanceId,
  sold,
  showEdit = true,
  compact = false,
}: {
  vehicleId: string;
  vehicleLabel: string;
  openMaintenanceId: string | null;
  sold?: boolean;
  showEdit?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("fleet.actions");
  const te = useTranslations("errors");
  const { writable, role } = useAgency();
  const [sheet, setSheet] = useState(false);
  const [pending, startTransition] = useTransition();

  const endMaintenance = () =>
    startTransition(async () => {
      if (!openMaintenanceId) return;
      const result = await endMaintenanceAction(openMaintenanceId);
      if (result.ok) toast.success(t("backInService"));
      else toast.error(te(result.error));
    });

  const sheetEl = sheet ? <MaintenanceSheet vehicleId={vehicleId} vehicleLabel={vehicleLabel} open={sheet} onOpenChange={setSheet} /> : null;

  if (compact) {
    const items: RowMenuItem[] = [{ label: t("view"), icon: EyeIcon, href: `/fleet/${vehicleId}` }];
    if (!sold) {
      items.push(
        openMaintenanceId
          ? { label: t("endMaintenance"), icon: PlayCircleIcon, onSelect: endMaintenance, disabled: pending || !writable }
          : { label: t("maintenance"), icon: WrenchIcon, onSelect: () => setSheet(true), disabled: !writable },
      );
    }
    if (showEdit && role === "admin") items.push({ label: t("edit"), icon: PencilIcon, href: `/fleet/${vehicleId}/edit` });
    return (
      <>
        <RowMenu label={t("menu", { car: vehicleLabel })} items={items} testId="vehicle-menu" />
        {sheetEl}
      </>
    );
  }

  return (
    <>
      {sold ? null : openMaintenanceId ? (
        <Button variant="outline" size="sm" disabled={pending || !writable} onClick={endMaintenance}>
          <PlayCircleIcon aria-hidden />
          {t("endMaintenance")}
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={!writable} onClick={() => setSheet(true)}>
          <WrenchIcon aria-hidden />
          {t("maintenance")}
        </Button>
      )}
      {showEdit ? (
        <Can role="admin">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/fleet/${vehicleId}/edit`}>
              <PencilIcon aria-hidden />
              {t("edit")}
            </Link>
          </Button>
        </Can>
      ) : null}
      {sheetEl}
    </>
  );
}
