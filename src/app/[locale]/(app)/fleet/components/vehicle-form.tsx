"use client";
import type * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { StickyActionBar } from "@/components/app/stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, fieldAria } from "@/components/ui/field";
import { DateField, MoneyField, PlateField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { saveVehicleAction } from "../actions";
import { CATEGORIES, FUELS, GEARBOXES, vehicleSchema, type VehicleInput } from "../schema";

export type VehicleFormValues = VehicleInput;

/** Add / edit a car. Every value is typed by the user — nothing is assumed. */
export function VehicleForm({ id, defaults }: { id?: string; defaults: Partial<VehicleFormValues> }) {
  const t = useTranslations("fleet.form");
  const tc = useTranslations("fleet");
  const te = useTranslations("errors");
  const tn = useTranslations("notices");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<VehicleInput, unknown, z.output<typeof vehicleSchema>>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      const result = await saveVehicleAction(form.getValues(), id);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<VehicleInput>, { message });
        }
        toast.error(te(result.error === "invalidForm" ? "invalidForm" : result.error));
        return;
      }
      toast.success(tn("saved"));
      router.push(`/fleet/${result.data.id}`);
    }),
  );

  const text = (name: FieldPath<VehicleInput>, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field id={name} label={label} error={errors[name as keyof typeof errors]?.message as string | undefined}>
      <Input {...fieldAria(name, errors[name as keyof typeof errors]?.message as string | undefined)} {...props} {...form.register(name)} />
    </Field>
  );
  const date = (name: "first_registration_date" | "insurance_expires_on" | "technical_visit_expires_on" | "oil_last_date", label: string) => (
    <Field id={name} label={label} error={errors[name]?.message}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => <DateField id={name} value={(field.value as string) ?? ""} onChange={field.onChange} onBlur={field.onBlur} aria-invalid={errors[name] ? true : undefined} />}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pb-24 sm:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>{t("car")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field id="plate" label={t("plate")} error={errors.plate?.message}>
            <Controller control={form.control} name="plate" render={({ field }) => <PlateField id="plate" value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-invalid={errors.plate ? true : undefined} />} />
          </Field>
          {text("brand_model", t("brandModel"), { placeholder: "Dacia Logan" })}
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-medium">{t("category")}</span>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <ChoiceChips name="category" label={t("category")} value={field.value} onChange={field.onChange} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" options={CATEGORIES.map((c) => ({ value: c, label: tc(`categories.${c}`) }))} />
              )}
            />
            {errors.category ? <p className="text-sm font-medium text-destructive">{te("invalidForm")}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("fuel")}</span>
            <Controller control={form.control} name="fuel" render={({ field }) => <ChoiceChips name="fuel" label={t("fuel")} value={field.value} onChange={field.onChange} className="grid-cols-2" options={FUELS.map((c) => ({ value: c, label: tc(`fuels.${c}`) }))} />} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("gearbox")}</span>
            <Controller control={form.control} name="gearbox" render={({ field }) => <ChoiceChips name="gearbox" label={t("gearbox")} value={field.value} onChange={field.onChange} className="grid-cols-2" options={GEARBOXES.map((c) => ({ value: c, label: tc(`gearboxes.${c}`) }))} />} />
          </div>
          <Field id="daily_rate" label={t("dailyRate")} error={errors.daily_rate?.message}>
            <Controller control={form.control} name="daily_rate" render={({ field }) => <MoneyField id="daily_rate" value={field.value ?? null} onChange={(v) => field.onChange(v ?? undefined)} aria-invalid={errors.daily_rate ? true : undefined} />} />
          </Field>
          {text("current_km", t("currentKm"), { inputMode: "numeric", dir: "ltr" })}
          {date("first_registration_date", t("firstRegistration"))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("papers")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {date("insurance_expires_on", t("insuranceEnd"))}
          {date("technical_visit_expires_on", t("visitEnd"))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("oil")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {text("oil_last_km", t("oilLastKm"), { inputMode: "numeric", dir: "ltr" })}
          {date("oil_last_date", t("oilLastDate"))}
          {text("oil_next_km", t("oilNextKm"), { inputMode: "numeric", dir: "ltr" })}
          <p className="text-sm text-muted-foreground md:col-span-3">{t("oilHint")}</p>
        </CardContent>
      </Card>

      <StickyActionBar>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={pending}>
          <SaveIcon aria-hidden />
          {t("save")}
        </Button>
      </StickyActionBar>
    </form>
  );
}
