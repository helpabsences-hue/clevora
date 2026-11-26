"use client";

import { IdCardIcon, TriangleAlertIcon, UserCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { ScanIdButton } from "@/components/app/scan-id-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field } from "@/components/ui/field";
import { DateField, PhoneField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { dayKey, daysBetween, formatDate } from "@/lib/format";
import { findClientAction, type FoundClient } from "../actions";
import type { DriverInput, ReservationInput } from "../schema";

type Prefix = "driver1" | "driver2";

function yearsSince(day: string, today: string): number {
  return Math.floor(daysBetween(day, today) / 365.25);
}

/**
 * One driver. The ID number is the FIRST field: when it matches a client of
 * the agency, every field is filled in (and can still be edited).
 */
export function DriverFields({
  form,
  prefix,
  minAge,
  minLicenseYears,
  errors,
}: {
  form: UseFormReturn<ReservationInput>;
  prefix: Prefix;
  minAge: number;
  minLicenseYears: number;
  errors: Record<string, string>;
}) {
  const t = useTranslations("reservations.driver");
  const [known, setKnown] = useState<FoundClient | null>(null);
  const lastLookup = useRef("");
  const idType = useWatch({ control: form.control, name: `${prefix}.id_type` }) ?? "cin";
  const idNumber = useWatch({ control: form.control, name: `${prefix}.id_number` }) ?? "";
  const birthDate = useWatch({ control: form.control, name: `${prefix}.birth_date` }) ?? "";
  const licenseDate = useWatch({ control: form.control, name: `${prefix}.license_issued_on` }) ?? "";
  const idExpires = useWatch({ control: form.control, name: `${prefix}.id_expires_on` }) ?? "";

  // Look up the client 300 ms after typing stops
  useEffect(() => {
    const key = `${idType}:${idNumber.toUpperCase().replace(/[\s\-.]/g, "")}`;
    if (key.length < 7 || key === lastLookup.current) return;
    const timer = setTimeout(async () => {
      lastLookup.current = key;
      const result = await findClientAction(idType, idNumber);
      if (!result.ok || !result.data) {
        setKnown(null);
        return;
      }
      const found = result.data;
      setKnown(found);
      for (const [field, value] of Object.entries(found.fields) as Array<[keyof DriverInput, string]>) {
        if (field === "id_number" || field === "id_type") continue;
        form.setValue(`${prefix}.${field}`, value ?? "", { shouldDirty: true });
      }
      toast.success(t("found", { name: found.fields.full_name }));
    }, 300);
    return () => clearTimeout(timer);
  }, [idType, idNumber, prefix, form, t]);

  const today = dayKey(new Date());
  const warnings: string[] = [];
  if (birthDate && yearsSince(birthDate, today) < minAge) warnings.push(t("tooYoung", { age: minAge }));
  if (licenseDate && yearsSince(licenseDate, today) < minLicenseYears) warnings.push(t("licenseTooRecent", { years: minLicenseYears }));
  if (idExpires && idExpires < today) warnings.push(t("idExpired"));

  const err = (f: string) => errors[`${prefix}.${f}`];
  const text = (f: keyof DriverInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field id={`${prefix}-${f}`} label={label} error={err(f)}>
      <Input id={`${prefix}-${f}`} aria-invalid={err(f) ? true : undefined} {...props} {...form.register(`${prefix}.${f}`)} />
    </Field>
  );
  const date = (f: "birth_date" | "id_expires_on" | "license_issued_on", label: string) => (
    <Field id={`${prefix}-${f}`} label={label} error={err(f)}>
      <Controller
        control={form.control}
        name={`${prefix}.${f}`}
        render={({ field }) => <DateField id={`${prefix}-${f}`} value={field.value ?? ""} onChange={field.onChange} />}
      />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <ScanIdButton
        className="self-start"
        onResult={(d) => {
          // Number first: if this person is already a client, the lookup fills the rest.
          form.setValue(`${prefix}.id_type`, d.id_type, { shouldDirty: true });
          form.setValue(`${prefix}.id_number`, d.id_number, { shouldDirty: true, shouldValidate: true });
          for (const f of ["full_name", "nationality", "birth_date", "id_expires_on"] as const) {
            if (d[f]) form.setValue(`${prefix}.${f}`, d[f], { shouldDirty: true });
          }
          setKnown(null);
          toast.success(t("scanned"));
        }}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("idType")}</span>
        <Controller
          control={form.control}
          name={`${prefix}.id_type`}
          render={({ field }) => (
            <ChoiceChips
              name={`${prefix}-id-type`}
              label={t("idType")}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                setKnown(null);
              }}
              className="grid-cols-2"
              options={[
                { value: "cin", label: t("cin"), icon: <IdCardIcon className="size-4" aria-hidden /> },
                { value: "passport", label: t("passport"), icon: <IdCardIcon className="size-4" aria-hidden /> },
              ]}
            />
          )}
        />
      </div>

      <Field id={`${prefix}-id_number`} label={idType === "passport" ? t("passportNumber") : t("cinNumber")} hint={t("idHint")} error={err("id_number")}>
        <Input
          id={`${prefix}-id_number`}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="text-lg font-semibold uppercase tracking-wide"
          aria-invalid={err("id_number") ? true : undefined}
          aria-describedby={`${prefix}-id_number-hint`}
          {...form.register(`${prefix}.id_number`, { onChange: () => setKnown(null) })}
        />
      </Field>

      {known ? (
        <Badge variant="success" className="self-start whitespace-normal py-1 text-sm" data-testid={`${prefix}-known`}>
          <UserCheckIcon aria-hidden />
          {known.lastRentalAt
            ? t("known", { count: known.rentals, date: formatDate(known.lastRentalAt) })
            : t("knownNoRental")}
        </Badge>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {text("full_name", t("fullName"), { autoComplete: "off" })}
        <Field id={`${prefix}-phone`} label={t("phone")} error={err("phone")}>
          <Controller control={form.control} name={`${prefix}.phone`} render={({ field }) => <PhoneField id={`${prefix}-phone`} value={field.value ?? ""} onChange={field.onChange} aria-invalid={err("phone") ? true : undefined} />} />
        </Field>
        {text("nationality", t("nationality"))}
        {text("address", t("address"))}
        {date("birth_date", t("birthDate"))}
        {text("birth_place", t("birthPlace"))}
        {date("id_expires_on", t("idExpires"))}
        {text("license_number", t("licenseNumber"), { dir: "ltr" })}
        {date("license_issued_on", t("licenseDate"))}
        {text("license_issued_place", t("licensePlace"))}
      </div>

      {warnings.length ? (
        <Alert variant="warning" data-testid={`${prefix}-warnings`}>
          <TriangleAlertIcon aria-hidden />
          <ul className="flex flex-col gap-0.5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
