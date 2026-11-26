"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelPaymentAction, confirmPaymentAction } from "../actions";

/** Confirm that the money arrived (creates the invoice and activates the plan), or cancel. */
export function PaymentActions({ id, label }: { id: string; label: string }) {
  const t = useTranslations("platform");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
        <CheckIcon aria-hidden />
        {t("confirmPayment")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await cancelPaymentAction(id);
            if (r.ok) toast.success(t("cancelled"));
            else toast.error(te(r.error));
          })
        }
      >
        <XIcon aria-hidden />
        {t("cancelPayment")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle")}
        description={t("confirmBody", { label })}
        confirmLabel={t("confirmPayment")}
        confirmIcon={<CheckIcon aria-hidden />}
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const r = await confirmPaymentAction(id);
            setOpen(false);
            if (r.ok) toast.success(t("confirmed", { invoice: r.data.invoice }));
            else toast.error(te(r.error));
          })
        }
      />
    </div>
  );
}
