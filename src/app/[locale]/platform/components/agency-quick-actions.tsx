"use client";

import { CalendarPlusIcon, PauseCircleIcon, PlayCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { agencyQuickAction } from "../actions";

type Action = "extend_trial" | "suspend" | "reactivate";

/** Extend the trial by 14 days, suspend or reactivate an agency (with a confirmation). */
export function AgencyQuickActions({ id, name, status }: { id: string; name: string; status: string }) {
  const t = useTranslations("platform.quick");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [pending, start] = useTransition();
  const run = (a: Action) =>
    start(async () => {
      const r = await agencyQuickAction(id, a);
      if (!r.ok) return void toast.error(te(r.error));
      toast.success(t(`${a}Done`));
      setConfirm(null);
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setConfirm("extend_trial")}>
        <CalendarPlusIcon aria-hidden />
        {t("extend_trial")}
      </Button>
      {status === "suspended" ? (
        <Button variant="outline" onClick={() => setConfirm("reactivate")}>
          <PlayCircleIcon aria-hidden />
          {t("reactivate")}
        </Button>
      ) : (
        <Button variant="outline" className="text-destructive" onClick={() => setConfirm("suspend")}>
          <PauseCircleIcon aria-hidden />
          {t("suspend")}
        </Button>
      )}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{confirm ? t(`${confirm}Title`, { name }) : ""}</DialogTitle>
            <DialogDescription>{confirm ? t(`${confirm}Body`) : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {tc("cancel")}
            </Button>
            <Button variant={confirm === "suspend" ? "destructive" : "default"} disabled={pending} onClick={() => confirm && run(confirm)} data-testid="quick-confirm">
              {confirm ? t(confirm) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
