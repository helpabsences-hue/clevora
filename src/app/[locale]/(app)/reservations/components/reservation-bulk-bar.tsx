"use client";

import { Trash2Icon, XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Can } from "@/components/app/agency-context";
import { SelectionBar, useSelection } from "@/components/app/selection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { bulkCancelReservationsAction, bulkDeleteReservationsAction } from "../actions";

/** Ticked reservations: cancel (everyone) or delete (admins, never-started ones only). */
export function ReservationBulkBar() {
  const t = useTranslations("reservations.bulk");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tv = useTranslations("validation");
  const { selected, clear } = useSelection();
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = [...selected];

  const report = (done: number, skipped: number, kind: "cancel" | "delete") => {
    if (done) toast.success(kind === "cancel" ? t("cancelled", { count: done }) : t("deleted", { count: done }));
    if (skipped) toast.warning(kind === "cancel" ? t("cancelSkipped", { count: skipped }) : t("deleteSkipped", { count: skipped }), { duration: 8000 });
  };

  const run = () =>
    startTransition(async () => {
      if (confirm === "cancel") {
        const r = await bulkCancelReservationsAction(ids, reason);
        if (!r.ok) {
          if (r.fieldErrors?.reason) return void setReasonError(tv(r.fieldErrors.reason));
          return void toast.error(te(r.error));
        }
        report(r.data.done, r.data.skipped, "cancel");
      } else if (confirm === "delete") {
        const r = await bulkDeleteReservationsAction(ids);
        if (!r.ok) return void toast.error(te(r.error));
        report(r.data.done, r.data.skipped, "delete");
      }
      setConfirm(null);
      setReason("");
      setReasonError(null);
      clear();
    });

  return (
    <>
      <SelectionBar countLabel={(n) => t("count", { count: n })} clearLabel={t("clear")}>
        <Button variant="outline" onClick={() => setConfirm("cancel")}>
          <XCircleIcon aria-hidden />
          {t("cancel")}
        </Button>
        <Can role="admin">
          <Button variant="destructive" onClick={() => setConfirm("delete")}>
            <Trash2Icon aria-hidden />
            {t("delete")}
          </Button>
        </Can>
      </SelectionBar>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{confirm === "delete" ? t("deleteTitle", { count: ids.length }) : t("cancelTitle", { count: ids.length })}</DialogTitle>
            <DialogDescription>{confirm === "delete" ? t("deleteBody") : t("cancelBody")}</DialogDescription>
          </DialogHeader>
          {confirm === "cancel" ? (
            <Field id="bulk-reason" label={t("reason")} error={reasonError ?? undefined}>
              <Input id="bulk-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} />
            </Field>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("back")}
            </Button>
            <Button variant={confirm === "delete" ? "destructive" : "default"} disabled={pending} onClick={run} data-testid="bulk-confirm">
              {confirm === "delete" ? <Trash2Icon aria-hidden /> : <XCircleIcon aria-hidden />}
              {confirm === "delete" ? t("deleteConfirm", { count: ids.length }) : t("cancelConfirm", { count: ids.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
