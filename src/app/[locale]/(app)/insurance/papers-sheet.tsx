"use client";

import { PencilIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { dayKey } from "@/lib/format";
import { updatePapersAction } from "./actions";

/** "+6 mois" / "+1 an" only prefill the date (from the old end date, or today) — the user confirms it. */
function plusMonths(from: string, months: number): string {
  const today = dayKey(new Date());
  const base = from && from > today ? from : today;
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function PapersSheet({
  vehicleId,
  label,
  insurance,
  visit,
  insurer,
  policy,
}: {
  vehicleId: string;
  label: string;
  insurance: string | null;
  visit: string | null;
  insurer: string | null;
  policy: string | null;
}) {
  const t = useTranslations("insurance");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tn = useTranslations("notices");
  const { writable } = useAgency();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ insurance_expires_on: insurance ?? "", technical_visit_expires_on: visit ?? "", insurer: insurer ?? "", policy_number: policy ?? "" });

  const quick = (field: "insurance_expires_on" | "technical_visit_expires_on", current: string | null) => (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setValues((v) => ({ ...v, [field]: plusMonths(current ?? "", 6) }))}>
        {t("plus6m")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setValues((v) => ({ ...v, [field]: plusMonths(current ?? "", 12) }))}>
        {t("plus1y")}
      </Button>
    </div>
  );

  const save = () =>
    startTransition(async () => {
      const r = await updatePapersAction(vehicleId, values);
      if (!r.ok) return void toast.error(te(r.error));
      toast.success(tn("saved"));
      setOpen(false);
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!writable}>
        <PencilIcon aria-hidden />
        {t("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field id={`ins-${vehicleId}`} label={t("insuranceEnd")} hint={t("quickHint")}>
              <DateField id={`ins-${vehicleId}`} value={values.insurance_expires_on} onChange={(v) => setValues((s) => ({ ...s, insurance_expires_on: v }))} />
            </Field>
            {quick("insurance_expires_on", insurance)}
            <Field id={`vis-${vehicleId}`} label={t("visitEnd")}>
              <DateField id={`vis-${vehicleId}`} value={values.technical_visit_expires_on} onChange={(v) => setValues((s) => ({ ...s, technical_visit_expires_on: v }))} />
            </Field>
            {quick("technical_visit_expires_on", visit)}
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <Field id={`insurer-${vehicleId}`} label={t("insurer")}>
                <Input id={`insurer-${vehicleId}`} value={values.insurer} onChange={(e) => setValues((s) => ({ ...s, insurer: e.target.value }))} />
              </Field>
              <Field id={`policy-${vehicleId}`} label={t("policy")}>
                <Input id={`policy-${vehicleId}`} dir="ltr" value={values.policy_number} onChange={(e) => setValues((s) => ({ ...s, policy_number: e.target.value }))} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button size="lg" onClick={save} disabled={pending}>
              <SaveIcon aria-hidden />
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
