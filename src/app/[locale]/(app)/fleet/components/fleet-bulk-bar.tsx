"use client";

import { ArchiveIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectionBar, useSelection } from "@/components/app/selection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { bulkDeleteVehiclesAction, bulkSetSoldAction, type BulkVehicleResult } from "../actions";

/** Admins: delete or mark sold the ticked cars. */
export function FleetBulkBar() {
  const t = useTranslations("fleet.bulk");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const { selected, clear } = useSelection();
  const [confirm, setConfirm] = useState<"delete" | "sold" | null>(null);
  const [kept, setKept] = useState<BulkVehicleResult["kept"]>([]);
  const [pending, startTransition] = useTransition();
  const ids = [...selected];

  const run = (what: "delete" | "sold", list: string[]) =>
    startTransition(async () => {
      if (what === "sold") {
        const r = await bulkSetSoldAction(list);
        if (!r.ok) return void toast.error(te(r.error));
        toast.success(t("soldDone", { count: r.data }));
        setKept([]);
      } else {
        const r = await bulkDeleteVehiclesAction(list);
        if (!r.ok) return void toast.error(te(r.error));
        if (r.data.deleted) toast.success(t("deleted", { count: r.data.deleted }));
        setKept(r.data.kept);
      }
      setConfirm(null);
      clear();
    });

  return (
    <>
      <SelectionBar countLabel={(n) => t("count", { count: n })} clearLabel={t("clear")}>
        <Button variant="outline" onClick={() => setConfirm("sold")}>
          <ArchiveIcon aria-hidden />
          {t("markSold")}
        </Button>
        <Button variant="destructive" onClick={() => setConfirm("delete")}>
          <Trash2Icon aria-hidden />
          {t("delete")}
        </Button>
      </SelectionBar>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{confirm === "sold" ? t("soldTitle", { count: ids.length }) : t("deleteTitle", { count: ids.length })}</DialogTitle>
            <DialogDescription>{confirm === "sold" ? t("soldBody") : t("deleteBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {tc("cancel")}
            </Button>
            <Button variant={confirm === "delete" ? "destructive" : "default"} disabled={pending} onClick={() => confirm && run(confirm, ids)} data-testid="bulk-confirm">
              {confirm === "delete" ? <Trash2Icon aria-hidden /> : <ArchiveIcon aria-hidden />}
              {confirm === "delete" ? t("deleteConfirm", { count: ids.length }) : t("soldConfirm", { count: ids.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kept.length > 0} onOpenChange={(o) => !o && setKept([])}>
        <DialogContent closeLabel={tc("close")} data-testid="bulk-kept">
          <DialogHeader>
            <DialogTitle>{t("keptTitle", { count: kept.length })}</DialogTitle>
            <DialogDescription>{t("keptBody")}</DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto text-sm">
            {kept.map((k) => (
              <li key={k.id} className="rounded-md bg-muted px-3 py-2">
                {k.label}
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setKept([])}>
              {t("keep")}
            </Button>
            <Button disabled={pending} onClick={() => run("sold", kept.map((k) => k.id))}>
              <ArchiveIcon aria-hidden />
              {t("soldConfirm", { count: kept.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
