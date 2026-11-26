"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IdCardIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ScanIdButton } from "@/components/app/scan-id-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field } from "@/components/ui/field";
import { DateField, PhoneField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { saveClientAction } from "../actions";
import { clientSchema, type ClientInput } from "../schema";

/** Add / edit a client. "Scanner la pièce" fills name, number, nationality and dates. */
export function ClientForm({ id, defaults }: { id?: string; defaults: ClientInput }) {
  const t = useTranslations("clients.form");
  const td = useTranslations("reservations.driver");
  const te = useTranslations("errors");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [existingId, setExistingId] = useState<string | null>(null);
  const form = useForm<ClientInput, unknown, z.output<typeof clientSchema>>({ resolver: zodResolver(clientSchema), defaultValues: defaults });
  const { errors } = form.formState;
  const idType = useWatch({ control: form.control, name: "id_type" }) ?? "cin";
  const err = (f: keyof ClientInput) => {
    const m = errors[f]?.message;
    return m ? (tv.has(m) ? tv(m) : m) : undefined;
  };

  const onSubmit = form.handleSubmit(() =>
    start(async () => {
      setExistingId(null);
      const r = await saveClientAction(form.getValues(), id);
      if (!r.ok) {
        if (r.error === "clientExists") setExistingId(r.fieldErrors?.existing_id ?? null);
        for (const [k, v] of Object.entries(r.fieldErrors ?? {})) if (k !== "existing_id") form.setError(k as keyof ClientInput, { message: v });
        return void toast.error(te(r.error));
      }
      toast.success(t("saved"));
      router.push(`/clients/${r.data.id}`);
    }),
  );

  const text = (f: keyof ClientInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field id={`c-${f}`} label={label} error={err(f)}>
      <Input id={`c-${f}`} aria-invalid={err(f) ? true : undefined} {...props} {...form.register(f)} />
    </Field>
  );
  const date = (f: "birth_date" | "id_expires_on" | "license_issued_on", label: string) => (
    <Field id={`c-${f}`} label={label} error={err(f)}>
      <Controller control={form.control} name={f} render={({ field }) => <DateField id={`c-${f}`} value={field.value ?? ""} onChange={field.onChange} />} />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("identity")}</CardTitle>
          <ScanIdButton
            onResult={(d) => {
              form.setValue("id_type", d.id_type, { shouldDirty: true });
              for (const f of ["id_number", "full_name", "nationality", "birth_date", "id_expires_on"] as const) if (d[f]) form.setValue(f, d[f], { shouldDirty: true, shouldValidate: true });
              toast.success(td("scanned"));
            }}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Controller
            control={form.control}
            name="id_type"
            render={({ field }) => (
              <ChoiceChips
                name="c-id-type"
                label={td("idType")}
                value={field.value}
                onChange={field.onChange}
                className="grid-cols-2"
                options={[
                  { value: "cin", label: td("cin"), icon: <IdCardIcon className="size-4" aria-hidden /> },
                  { value: "passport", label: td("passport"), icon: <IdCardIcon className="size-4" aria-hidden /> },
                ]}
              />
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {text("id_number", idType === "passport" ? td("passportNumber") : td("cinNumber"), { dir: "ltr", autoCapitalize: "characters", className: "text-lg font-semibold uppercase tracking-wide" })}
            {text("full_name", td("fullName"), { autoComplete: "off" })}
            {text("nationality", td("nationality"))}
            {date("birth_date", td("birthDate"))}
            {text("birth_place", td("birthPlace"))}
            {date("id_expires_on", td("idExpires"))}
          </div>
          {existingId ? (
            <Alert variant="warning" data-testid="client-exists">
              {t("exists")}{" "}
              <Link href={`/clients/${existingId}`} className="font-semibold underline">
                {t("openExisting")}
              </Link>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("contact")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field id="c-phone" label={td("phone")} error={err("phone")}>
            <Controller control={form.control} name="phone" render={({ field }) => <PhoneField id="c-phone" value={field.value ?? ""} onChange={field.onChange} aria-invalid={err("phone") ? true : undefined} />} />
          </Field>
          {text("email", t("email"), { type: "email", dir: "ltr", autoComplete: "off" })}
          <div className="md:col-span-2">{text("address", td("address"))}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("license")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {text("license_number", td("licenseNumber"), { dir: "ltr" })}
          {date("license_issued_on", td("licenseDate"))}
          {text("license_issued_place", td("licensePlace"))}
          <div className="md:col-span-3">
            <Field id="c-notes" label={t("notes")} hint={t("notesHint")} error={err("notes")}>
              <textarea id="c-notes" rows={3} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" {...form.register("notes")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex justify-end md:bottom-4">
        <Button type="submit" size="lg" disabled={pending} className="shadow-lg">
          <SaveIcon aria-hidden />
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
