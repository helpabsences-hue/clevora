"use client";

import { CameraIcon, PencilIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DateField, MoneyField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { YesNo } from "@/components/ui/yes-no";
import { dayKey } from "@/lib/format";
import { saveChargeAction } from "../actions";
import { CHARGE_CATEGORIES, MANUAL_CHARGE_CATEGORIES } from "../schema";

export type ChargeRow = {
  id: string;
  date: string;
  category: (typeof CHARGE_CATEGORIES)[number];
  amount: number;
  vehicle_id: string | null;
  campaign_name: string | null;
  note: string | null;
  is_recurring: boolean;
};

export function ChargeSheet({
  charge,
  cars,
  defaultDate,
  open: controlledOpen,
  onOpenChange,
}: {
  charge?: ChargeRow;
  cars: Array<{ id: string; label: string }>;
  defaultDate?: string;
  /** Controlled from outside (e.g. a row menu): no trigger button is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("charges");
  const tf = useTranslations("fleet");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tv = useTranslations("validation");
  const tn = useTranslations("notices");
  const { writable } = useAgency();
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const setOpen = (o: boolean) => (controlled ? onOpenChange?.(o) : setOwnOpen(o));
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<ChargeRow["category"] | undefined>(charge?.category);
  const [date, setDate] = useState(charge?.date ?? defaultDate ?? dayKey(new Date()));
  const [amount, setAmount] = useState<number | null>(charge?.amount ?? null);
  const [forCar, setForCar] = useState<boolean>(Boolean(charge?.vehicle_id));
  const [vehicleId, setVehicleId] = useState(charge?.vehicle_id ?? "");
  const [campaign, setCampaign] = useState(charge?.campaign_name ?? "");
  const [note, setNote] = useState(charge?.note ?? "");
  const [recurring, setRecurring] = useState(charge?.is_recurring ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const receipt = useRef<HTMLInputElement>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);

  const save = () => {
    const data = new FormData();
    if (charge) data.set("id", charge.id);
    data.set("category", category ?? "");
    data.set("date", date);
    data.set("amount", String(amount ?? ""));
    data.set("vehicle_id", forCar ? vehicleId : "");
    data.set("campaign_name", campaign);
    data.set("note", note);
    data.set("is_recurring", String(recurring));
    const file = receipt.current?.files?.[0];
    if (file) data.set("receipt", file);
    startTransition(async () => {
      const r = await saveChargeAction(data);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(te(r.error));
        return;
      }
      toast.success(tn("saved"));
      setOpen(false);
      if (!charge) {
        setAmount(null);
        setNote("");
        setCampaign("");
        setReceiptName(null);
      }
    });
  };

  return (
    <>
      {controlled ? null : charge ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={!writable}>
          <PencilIcon aria-hidden />
          {t("edit")}
        </Button>
      ) : (
        <Button size="lg" onClick={() => setOpen(true)} disabled={!writable}>
          <PlusIcon aria-hidden />
          {t("add")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{charge ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("category")}</span>
              <ChoiceChips name="category" label={t("category")} value={category} onChange={setCategory} className="grid-cols-2 sm:grid-cols-3" options={(charge?.category === "vidange" ? CHARGE_CATEGORIES : MANUAL_CHARGE_CATEGORIES).map((c) => ({ value: c, label: tf(`chargeCategories.${c}`) }))} />
              {errors.category ? <p role="alert" className="text-sm font-medium text-destructive">{t("categoryRequired")}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="charge-date" label={t("date")} error={errors.date}>
                <DateField id="charge-date" value={date} onChange={setDate} />
              </Field>
              <Field id="charge-amount" label={t("amount")} error={errors.amount}>
                <MoneyField id="charge-amount" value={amount} onChange={setAmount} aria-invalid={errors.amount ? true : undefined} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("for")}</span>
              <ChoiceChips
                name="for"
                label={t("for")}
                value={forCar ? "car" : "agency"}
                onChange={(v) => setForCar(v === "car")}
                options={[
                  { value: "agency", label: t("forAgency") },
                  { value: "car", label: t("forCar") },
                ]}
              />
              {forCar ? (
                <select
                  aria-label={t("chooseCar")}
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
                >
                  <option value="">{t("chooseCar")}</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {category === "publicite" ? (
              <Field id="charge-campaign" label={t("campaign")}>
                <Input id="charge-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder={t("campaignPlaceholder")} />
              </Field>
            ) : null}
            <Field id="charge-note" label={t("note")}>
              <Textarea id="charge-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("recurring")}</span>
              <YesNo label={t("recurring")} value={recurring} onChange={setRecurring} />
              <span className="text-sm text-muted-foreground">{t("recurringHint")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={receipt} type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" id="charge-receipt" onChange={(e) => setReceiptName(e.target.files?.[0]?.name ?? null)} />
              <Button type="button" variant="outline" onClick={() => receipt.current?.click()}>
                <CameraIcon aria-hidden />
                {t("receipt")}
              </Button>
              {receiptName ? <span className="truncate text-sm text-muted-foreground">{receiptName}</span> : null}
              {errors.receipt ? <p role="alert" className="text-sm font-medium text-destructive">{tv(errors.receipt)}</p> : null}
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
