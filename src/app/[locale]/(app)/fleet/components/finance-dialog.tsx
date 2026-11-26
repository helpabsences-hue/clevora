"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useAgency } from "@/components/app/agency-context";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { DateField, MoneyField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { financeSchema, type FinanceInput } from "@/lib/fleet/finance";
import { formatMoney } from "@/lib/format";
import { deleteFinanceAction, saveFinanceAction } from "../actions";

/** "Achat et crédit" of a car (admins). */
export function FinanceDialog({ vehicleId, label, defaults }: { vehicleId: string; label: string; defaults: FinanceInput | null }) {
  const t = useTranslations("fleet.finance");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const { writable } = useAgency();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<FinanceInput, unknown, z.output<typeof financeSchema>>({
    resolver: zodResolver(financeSchema),
    defaultValues: defaults ?? { purchase_date: "", purchase_price: null, mode: "credit", down_payment: null, monthly_payment: null, months: null, first_payment_on: "", lender: "" },
  });
  const { errors } = form.formState;
  const [mode, monthly, months, down] = useWatch({ control: form.control, name: ["mode", "monthly_payment", "months", "down_payment"] });
  const creditTotal = mode === "credit" && monthly && months ? (down ?? 0) + monthly * months : null;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      const r = await saveFinanceAction(vehicleId, form.getValues());
      if (!r.ok) {
        for (const [k, v] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof FinanceInput, { message: v });
        return void toast.error(te(r.error));
      }
      toast.success(t("saved"));
      setOpen(false);
    }),
  );
  const remove = () =>
    startTransition(async () => {
      const r = await deleteFinanceAction(vehicleId);
      if (!r.ok) return void toast.error(te(r.error));
      toast.success(t("removed"));
      form.reset({ purchase_date: "", purchase_price: null, mode: "credit", down_payment: null, monthly_payment: null, months: null, first_payment_on: "", lender: "" });
      setOpen(false);
    });

  const money = (name: "purchase_price" | "down_payment" | "monthly_payment", id: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => <MoneyField value={field.value ?? null} onChange={field.onChange} onBlur={field.onBlur} {...fieldAria(id, errors[name]?.message)} />}
    />
  );

  return (
    <>
      <Button variant={defaults ? "outline" : "default"} onClick={() => setOpen(true)} disabled={!writable}>
        {defaults ? <PencilIcon aria-hidden /> : <PlusIcon aria-hidden />}
        {defaults ? t("edit") : t("add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-2xl" data-testid="finance-dialog">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field id="fin-date" label={t("purchaseDate")} error={errors.purchase_date?.message}>
              <Controller control={form.control} name="purchase_date" render={({ field }) => <DateField value={field.value} onChange={field.onChange} onBlur={field.onBlur} {...fieldAria("fin-date", errors.purchase_date?.message)} />} />
            </Field>
            <Field id="fin-price" label={t("purchasePrice")} error={errors.purchase_price?.message}>
              {money("purchase_price", "fin-price")}
            </Field>
            <div className="sm:col-span-2">
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <ChoiceChips
                    name="fin-mode"
                    label={t("mode")}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "credit", label: t("credit") },
                      { value: "cash", label: t("cash") },
                    ]}
                  />
                )}
              />
            </div>
            {mode === "credit" ? (
              <>
                <Field id="fin-down" label={t("downPayment")} error={errors.down_payment?.message}>
                  {money("down_payment", "fin-down")}
                </Field>
                <Field id="fin-monthly" label={t("creditPerMonth")} error={errors.monthly_payment?.message}>
                  {money("monthly_payment", "fin-monthly")}
                </Field>
                <Field id="fin-months" label={t("months")} error={errors.months?.message}>
                  <Controller
                    control={form.control}
                    name="months"
                    render={({ field }) => (
                      <Input
                        inputMode="numeric"
                        dir="ltr"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "").slice(0, 3);
                          field.onChange(d ? Number(d) : null);
                        }}
                        onBlur={field.onBlur}
                        {...fieldAria("fin-months", errors.months?.message)}
                      />
                    )}
                  />
                </Field>
                <Field id="fin-first" label={t("firstPayment")} error={errors.first_payment_on?.message}>
                  <Controller control={form.control} name="first_payment_on" render={({ field }) => <DateField value={field.value} onChange={field.onChange} onBlur={field.onBlur} {...fieldAria("fin-first", errors.first_payment_on?.message)} />} />
                </Field>
                <Field id="fin-lender" label={t("lender")} className="sm:col-span-2">
                  <Input id="fin-lender" maxLength={120} placeholder={t("lenderPlaceholder")} {...form.register("lender")} />
                </Field>
                {creditTotal ? (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm sm:col-span-2" data-testid="finance-total">
                    {t("creditTotal", { total: formatMoney(creditTotal) })}
                  </p>
                ) : null}
              </>
            ) : null}
            <p className="text-sm text-muted-foreground sm:col-span-2">{t("noDoubleCount")}</p>
            <DialogFooter className="gap-2 sm:col-span-2">
              {defaults ? (
                <Button type="button" variant="outline" onClick={remove} disabled={pending} className="sm:me-auto">
                  <Trash2Icon aria-hidden />
                  {t("remove")}
                </Button>
              ) : null}
              <Button type="submit" size="lg" disabled={pending}>
                <SaveIcon aria-hidden />
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
