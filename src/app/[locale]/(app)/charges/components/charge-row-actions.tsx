"use client";

import { PencilIcon, ReceiptIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { RowMenu } from "@/components/app/row-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteChargeAction, receiptUrlAction } from "../actions";
import { ChargeSheet, type ChargeRow } from "./charge-sheet";

/** Receipt, edit, delete. `compact`: one "⋯" menu for table rows. */
export function ChargeRowActions({
  charge,
  cars,
  receiptPath,
  compact = false,
}: {
  charge: ChargeRow;
  cars: Array<{ id: string; label: string }>;
  receiptPath: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("charges");
  const te = useTranslations("errors");
  const tn = useTranslations("notices");
  const { writable } = useAgency();
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pending, startTransition] = useTransition();

  const openReceipt = () =>
    startTransition(async () => {
      if (!receiptPath) return;
      const r = await receiptUrlAction(receiptPath);
      if (r.ok) window.open(r.data, "_blank", "noopener,noreferrer");
      else toast.error(te(r.error));
    });

  const dialogs = (
    <>
      <ChargeSheet charge={charge} cars={cars} open={edit} onOpenChange={setEdit} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={t("delete")}
        confirmIcon={<Trash2Icon aria-hidden />}
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const r = await deleteChargeAction(charge.id);
            setConfirm(false);
            if (r.ok) toast.success(tn("saved"));
            else toast.error(te(r.error));
          })
        }
      />
    </>
  );

  if (compact) {
    return (
      <>
        {receiptPath ? (
          <Button variant="ghost" size="icon" onClick={openReceipt} aria-label={t("viewReceipt")} title={t("viewReceipt")} className="text-muted-foreground">
            <ReceiptIcon aria-hidden />
          </Button>
        ) : null}
        <RowMenu
          label={t("menu")}
          testId="charge-menu"
          items={[
            { label: t("edit"), icon: PencilIcon, onSelect: () => setEdit(true), disabled: !writable },
            { label: t("delete"), icon: Trash2Icon, onSelect: () => setConfirm(true), disabled: !writable, destructive: true, separatorBefore: true },
          ]}
        />
        {dialogs}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {receiptPath ? (
        <Button variant="ghost" size="sm" onClick={openReceipt}>
          <ReceiptIcon aria-hidden />
          {t("viewReceipt")}
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" onClick={() => setEdit(true)} disabled={!writable}>
        <PencilIcon aria-hidden />
        {t("edit")}
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" disabled={!writable} onClick={() => setConfirm(true)}>
        <Trash2Icon aria-hidden />
        {t("delete")}
      </Button>
      {dialogs}
    </div>
  );
}
