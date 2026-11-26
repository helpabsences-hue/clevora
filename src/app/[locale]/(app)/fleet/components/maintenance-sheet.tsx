"use client";

import { TriangleAlertIcon, WrenchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Arrow, Ltr } from "@/components/app/ltr";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/fields";
import { Textarea } from "@/components/ui/textarea";
import { dayKey } from "@/lib/format";
import { maintenanceOverlapsAction, startMaintenanceAction, type OverlappingReservation } from "../actions";
import { MAINTENANCE_REASONS, maintenanceSchema } from "../schema";

/** "Maintenance" button → sheet with the reason (big chips), dates and a note. */
export function MaintenanceSheet({
  vehicleId,
  vehicleLabel,
  open,
  onOpenChange,
}: {
  vehicleId: string;
  vehicleLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("fleet.maintenance");
  const tr = useTranslations("fleet.reasons");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<(typeof MAINTENANCE_REASONS)[number] | undefined>();
  const [startsOn, setStartsOn] = useState(() => dayKey(new Date()));
  const [expectedEnd, setExpectedEnd] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overlaps, setOverlaps] = useState<OverlappingReservation[]>([]);

  // Warn about reservations inside the period (debounced)
  useEffect(() => {
    if (!open || !startsOn) return;
    const timer = setTimeout(async () => {
      const result = await maintenanceOverlapsAction(vehicleId, startsOn, expectedEnd || null);
      setOverlaps(result.ok ? result.data : []);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, vehicleId, startsOn, expectedEnd]);

  const submit = () => {
    const input = { vehicleId, reason: reason as (typeof MAINTENANCE_REASONS)[number], starts_on: startsOn, expected_end_on: expectedEnd, note };
    const parsed = maintenanceSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await startMaintenanceAction(input);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onOpenChange(false);
      setReason(undefined);
      setExpectedEnd("");
      setNote("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{vehicleLabel}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("reason")}</span>
            <ChoiceChips
              name="reason"
              label={t("reason")}
              value={reason}
              onChange={setReason}
              className="grid-cols-2 sm:grid-cols-3"
              options={MAINTENANCE_REASONS.map((r) => ({ value: r, label: tr(r) }))}
            />
            {errors.reason ? <p role="alert" className="text-sm font-medium text-destructive">{t("reasonRequired")}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="m-start" label={t("startsOn")} error={errors.starts_on}>
              <DateField id="m-start" value={startsOn} onChange={setStartsOn} />
            </Field>
            <Field id="m-end" label={t("expectedEnd")} hint={t("expectedEndHint")} error={errors.expected_end_on}>
              <DateField id="m-end" value={expectedEnd} onChange={setExpectedEnd} min={startsOn} />
            </Field>
          </div>
          <Field id="m-note" label={t("note")}>
            <Textarea id="m-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
          {overlaps.length ? (
            <Alert variant="warning" data-testid="maintenance-overlaps">
              <TriangleAlertIcon aria-hidden />
              <div className="flex flex-col gap-1">
                <strong>{t("overlapTitle", { count: overlaps.length })}</strong>
                <ul className="flex flex-col gap-0.5">
                  {overlaps.map((r) => (
                    <li key={r.id}>
                      <Ltr>{r.contract_number}</Ltr> · {r.client} · <Ltr>{r.startLabel}</Ltr><Arrow /><Ltr>{r.endLabel}</Ltr>
                    </li>
                  ))}
                </ul>
                <span>{t("overlapHelp")}</span>
              </div>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" size="lg" onClick={submit} disabled={pending}>
            <WrenchIcon aria-hidden />
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
