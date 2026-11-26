"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUpIcon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useAgency } from "@/components/app/agency-context";
import { AgencyLogo } from "@/components/app/agency-logo";
import { ColorPicker, HeaderPreview } from "@/components/app/brand-picker";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, fieldAria } from "@/components/ui/field";
import { MoneyField, PhoneField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { YesNo } from "@/components/ui/yes-no";
import type { ActionResult } from "@/lib/action-result";
import { LOGO_TYPES } from "@/lib/storage";
import { removeLogoAction, saveSettingsAction, uploadLogoAction } from "../actions";
import {
  agencySettingsSchema,
  alertSettingsSchema,
  assistantSettingsSchema,
  contractSettingsSchema,
  inspectionSettingsSchema,
  legalSettingsSchema,
  type SettingsInput,
  type SettingsSection,
} from "../schema";

function useSaver() {
  const te = useTranslations("errors");
  const tn = useTranslations("notices");
  return <T extends FieldValues, O extends FieldValues>(result: ActionResult, form?: UseFormReturn<T, unknown, O>) => {
    if (result.ok) {
      toast.success(tn("saved"));
      return;
    }
    if (form && result.fieldErrors) for (const [field, message] of Object.entries(result.fieldErrors)) form.setError(field as Path<T>, { message });
    toast.error(te(result.error));
  };
}

/** One settings section: a form, its fields, and a big Save button. */
function SectionForm<S extends SettingsSection, T extends FieldValues, O extends FieldValues>({
  section,
  form,
  children,
}: {
  section: S;
  form: UseFormReturn<T, unknown, O>;
  children: ReactNode;
}) {
  const t = useTranslations("settings");
  const { writable } = useAgency();
  const save = useSaver();
  const [pending, startTransition] = useTransition();
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      save(await saveSettingsAction(section, form.getValues() as unknown as SettingsInput<S>), form);
    }),
  );
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" data-testid={`settings-${section}`}>
      {children}
      <Button type="submit" size="lg" disabled={pending || !writable} className="self-start">
        <SaveIcon aria-hidden />
        {t("save")}
      </Button>
    </form>
  );
}

function err(form: UseFormReturn<FieldValues>, name: string): string | undefined {
  return form.formState.errors[name]?.message as string | undefined;
}

// ---------------------------------------------------------------------------
// Agence: name, logo, colour, contact
// ---------------------------------------------------------------------------
export function AgencyForm({ values, logoUrl, userName }: { values: SettingsInput<"agency">; logoUrl: string | null; userName: string }) {
  const t = useTranslations("settings.agency");
  const tv = useTranslations("validation");
  const ts = useTranslations("auth.signup.brand");
  const { writable } = useAgency();
  const save = useSaver();
  const form = useForm<z.input<typeof agencySettingsSchema>, unknown, z.output<typeof agencySettingsSchema>>({ resolver: zodResolver(agencySettingsSchema), defaultValues: values });
  const f = form as unknown as UseFormReturn<FieldValues>;
  const logoInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [logoError, setLogoError] = useState<string | null>(null);
  const color = useWatch({ control: form.control, name: "brand_color" });
  const name = useWatch({ control: form.control, name: "name" });

  const upload = (file: File | undefined) => {
    if (!file) return;
    const data = new FormData();
    data.set("logo", file);
    startTransition(async () => {
      const r = await uploadLogoAction(data);
      setLogoError(r.ok ? null : (r.fieldErrors?.logo ?? null));
      save(r);
      if (logoInput.current) logoInput.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{ts("logo")}</span>
        <div className="flex flex-wrap items-center gap-3">
          <AgencyLogo name={name || "?"} url={logoUrl} size={64} />
          <input ref={logoInput} id="settings-logo" aria-label={ts("logo")} type="file" accept={Object.keys(LOGO_TYPES).join(",")} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-describedby="settings-logo-hint" />
          <Button type="button" variant="outline" onClick={() => logoInput.current?.click()} disabled={pending || !writable}>
            <ImageUpIcon aria-hidden />
            {logoUrl ? ts("changeLogo") : ts("addLogo")}
          </Button>
          {logoUrl ? (
            <Button type="button" variant="ghost" data-testid="settings-logo-remove" disabled={pending || !writable} onClick={() => startTransition(async () => save(await removeLogoAction()))}>
              <Trash2Icon aria-hidden />
              {ts("removeLogo")}
            </Button>
          ) : null}
        </div>
        <p id="settings-logo-hint" className="text-sm text-muted-foreground">{ts("logoHint")}</p>
        {logoError ? <p role="alert" className="text-sm font-medium text-destructive">{tv(logoError)}</p> : null}
      </div>

      <SectionForm section="agency" form={form}>
        <Field id="s-name" label={t("name")} error={err(f, "name")}>
          <Input autoComplete="organization" {...fieldAria("s-name", err(f, "name"))} {...form.register("name")} />
        </Field>
        <Controller
          control={form.control}
          name="brand_color"
          render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} label={ts("color")} customLabel={ts("customColor")} />}
        />
        <HeaderPreview agencyName={name} userName={userName} logoUrl={logoUrl} color={color} labels={{ preview: ts("preview"), role: ts("previewRole"), button: ts("previewButton"), fallback: ts("tooLight") }} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-address" label={t("address")} error={err(f, "address")} className="sm:col-span-2">
            <Input id="s-address" autoComplete="street-address" {...form.register("address")} />
          </Field>
          <Field id="s-city" label={t("city")} error={err(f, "city")}>
            <Input id="s-city" autoComplete="address-level2" {...form.register("city")} />
          </Field>
          <Field id="s-phone" label={t("phone")} error={err(f, "phone")}>
            <Controller control={form.control} name="phone" render={({ field }) => <PhoneField value={field.value ?? ""} onChange={field.onChange} {...fieldAria("s-phone", err(f, "phone"))} />} />
          </Field>
          <Field id="s-email" label={t("email")} error={err(f, "email")} className="sm:col-span-2">
            <Input id="s-email" type="email" inputMode="email" autoComplete="email" dir="ltr" {...form.register("email")} />
          </Field>
        </div>
      </SectionForm>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Informations légales
// ---------------------------------------------------------------------------
export function LegalForm({ values }: { values: SettingsInput<"legal"> }) {
  const t = useTranslations("settings.legal");
  const form = useForm<z.input<typeof legalSettingsSchema>, unknown, z.output<typeof legalSettingsSchema>>({ resolver: zodResolver(legalSettingsSchema), defaultValues: values });
  const f = form as unknown as UseFormReturn<FieldValues>;
  const fields = ["rc", "ice", "if_number", "patente", "cnss"] as const;
  return (
    <SectionForm section="legal" form={form}>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((k) => (
          <Field key={k} id={`s-${k}`} label={t(k)} error={err(f, k)} hint={k === "ice" ? t("iceHint") : undefined}>
            <Input dir="ltr" inputMode={k === "ice" ? "numeric" : undefined} {...fieldAria(`s-${k}`, err(f, k))} {...form.register(k)} />
          </Field>
        ))}
      </div>
    </SectionForm>
  );
}

// ---------------------------------------------------------------------------
// Contrat: defaults, lists, terms
// ---------------------------------------------------------------------------
function ItemsEditor({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations("settings.contract");
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || value.includes(v) || value.length >= 30) return;
    onChange([...value, v.slice(0, 40)]);
    setDraft("");
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <ul className="flex flex-wrap gap-2" data-testid={`${id}-items`}>
        {value.map((item) => (
          <li key={item} className="inline-flex min-h-11 items-center gap-1 rounded-full border bg-background ps-3 pe-1 text-sm">
            <span dir="auto">{item}</span>
            <button type="button" onClick={() => onChange(value.filter((x) => x !== item))} aria-label={t("removeItem", { item })} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-accent">
              <XIcon className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={40}
          placeholder={t("newItem")}
          aria-label={t("newItemLabel", { list: label })}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <PlusIcon aria-hidden />
          {t("addItem")}
        </Button>
      </div>
    </fieldset>
  );
}

export function ContractForm({ values, nextNumber }: { values: SettingsInput<"contract">; nextNumber: number }) {
  const t = useTranslations("settings.contract");
  const form = useForm<z.input<typeof contractSettingsSchema>, unknown, z.output<typeof contractSettingsSchema>>({ resolver: zodResolver(contractSettingsSchema), defaultValues: values });
  const f = form as unknown as UseFormReturn<FieldValues>;
  const prefix = useWatch({ control: form.control, name: "contract_number_prefix" });
  const intField = (name: "min_driver_age" | "min_license_years", label: string, hint?: string) => (
    <Field id={`s-${name}`} label={label} error={err(f, name)} hint={hint}>
      <Input type="number" inputMode="numeric" min={0} {...fieldAria(`s-${name}`, err(f, name))} {...form.register(name, { valueAsNumber: true })} />
    </Field>
  );
  return (
    <SectionForm section="contract" form={form}>
      <div className="grid gap-4 sm:grid-cols-2">
        {intField("min_driver_age", t("minAge"))}
        {intField("min_license_years", t("minLicenseYears"))}
        {(["default_deposit", "default_franchise"] as const).map((name) => (
          <Field key={name} id={`s-${name}`} label={t(name)} error={err(f, name)}>
            <Controller control={form.control} name={name} render={({ field }) => <MoneyField id={`s-${name}`} value={field.value ?? null} onChange={(v) => field.onChange(v ?? 0)} />} />
          </Field>
        ))}
        <Field id="s-prefix" label={t("prefix")} error={err(f, "contract_number_prefix")} hint={t("prefixHint", { example: `${prefix ?? ""}${nextNumber}` })}>
          <Input id="s-prefix" dir="ltr" maxLength={20} {...form.register("contract_number_prefix")} />
        </Field>
      </div>
      <Controller
        control={form.control}
        name="equipment_items"
        render={({ field }) => <ItemsEditor id="s-equipment" label={t("equipment")} hint={t("equipmentHint")} value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="document_items"
        render={({ field }) => <ItemsEditor id="s-documents" label={t("documents")} hint={t("documentsHint")} value={field.value} onChange={field.onChange} />}
      />
      <Field id="s-terms" label={t("terms")} error={err(f, "contract_terms")} hint={t("termsHint")}>
        <Textarea id="s-terms" rows={10} dir="auto" maxLength={8000} {...form.register("contract_terms")} />
      </Field>
    </SectionForm>
  );
}

// ---------------------------------------------------------------------------
// Alertes
// ---------------------------------------------------------------------------
export function AlertsForm({ values }: { values: SettingsInput<"alerts"> }) {
  const t = useTranslations("settings.alerts");
  const form = useForm<z.input<typeof alertSettingsSchema>, unknown, z.output<typeof alertSettingsSchema>>({ resolver: zodResolver(alertSettingsSchema), defaultValues: values });
  const f = form as unknown as UseFormReturn<FieldValues>;
  return (
    <SectionForm section="alerts" form={form}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="s-days" label={t("days")} error={err(f, "alert_days_before")} hint={t("daysHint")}>
          <Input id="s-days" type="number" inputMode="numeric" min={1} max={365} {...form.register("alert_days_before", { valueAsNumber: true })} />
        </Field>
        <Field id="s-km" label={t("km")} error={err(f, "alert_km_before")} hint={t("kmHint")}>
          <Input id="s-km" type="number" inputMode="numeric" min={100} step={100} {...form.register("alert_km_before", { valueAsNumber: true })} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("who")}</span>
        <Controller
          control={form.control}
          name="alert_roles"
          render={({ field }) => (
            <ChoiceChips
              name="alert_roles"
              label={t("who")}
              value={field.value.includes("staff") ? "all" : "admins"}
              onChange={(v) => field.onChange(v === "all" ? ["admin", "staff"] : ["admin"])}
              options={[
                { value: "admins", label: t("adminsOnly"), description: t("adminsOnlyHint") },
                { value: "all", label: t("everyone"), description: t("everyoneHint") },
              ]}
            />
          )}
        />
      </div>
    </SectionForm>
  );
}

// ---------------------------------------------------------------------------
// Assistant IA on/off
// ---------------------------------------------------------------------------
export function AssistantForm({ values, inPlan }: { values: SettingsInput<"assistant">; inPlan: boolean }) {
  const t = useTranslations("settings.assistant");
  const form = useForm<z.input<typeof assistantSettingsSchema>, unknown, z.output<typeof assistantSettingsSchema>>({ resolver: zodResolver(assistantSettingsSchema), defaultValues: values });
  return (
    <SectionForm section="assistant" form={form}>
      {!inPlan ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t("notInPlan")}</p> : null}
      <Controller control={form.control} name="ai_enabled" render={({ field }) => <YesNo id="s-ai" label={t("enabled")} value={field.value} onChange={field.onChange} />} />
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
    </SectionForm>
  );
}

// ---------------------------------------------------------------------------
// Inspection on/off + photos or video
// ---------------------------------------------------------------------------
export function InspectionForm({ values }: { values: SettingsInput<"inspection"> }) {
  const t = useTranslations("settings.inspection");
  const form = useForm<z.input<typeof inspectionSettingsSchema>, unknown, z.output<typeof inspectionSettingsSchema>>({ resolver: zodResolver(inspectionSettingsSchema), defaultValues: values });
  const enabled = useWatch({ control: form.control, name: "inspection_enabled" });
  return (
    <SectionForm section="inspection" form={form}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("enabled")}</span>
        <Controller control={form.control} name="inspection_enabled" render={({ field }) => <YesNo id="s-inspection" label={t("enabled")} value={field.value} onChange={field.onChange} />} />
      </div>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {enabled ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("mode")}</span>
          <Controller
            control={form.control}
            name="inspection_mode"
            render={({ field }) => (
              <ChoiceChips
                name="inspection_mode"
                label={t("mode")}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                options={[
                  { value: "photos", label: t("photos"), description: t("photosHint") },
                  { value: "video", label: t("video"), description: t("videoHint") },
                ]}
              />
            )}
          />
        </div>
      ) : null}
    </SectionForm>
  );
}
