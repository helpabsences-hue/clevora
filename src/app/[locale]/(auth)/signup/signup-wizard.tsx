"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ImageUpIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type * as React from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { AgencyLogo } from "@/components/app/agency-logo";
import { brandVars, ColorPicker, HeaderPreview } from "@/components/app/brand-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FALLBACK_BRAND } from "@/lib/brand";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { signupAgencyOnlySchema, signupSchema } from "../schema";
import { signupAction } from "./actions";

type Values = z.input<typeof signupSchema>;
type StepId = "account" | "agency" | "brand";

const STEP_FIELDS: Record<StepId, FieldPath<Values>[]> = {
  account: ["fullName", "email", "phone", "password"],
  agency: ["agencyName", "city", "agencyPhone"],
  brand: ["brandColor"],
};

export function SignupWizard({ loggedInName }: { loggedInName: string | null }) {
  const t = useTranslations("auth.signup");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const locale = useLocale() as Values["locale"];
  const steps: StepId[] = loggedInName ? ["agency", "brand"] : ["account", "agency", "brand"];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | undefined>();
  const logoInput = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<Values>({
    // Logged-in users skip the account step: validate only what is shown.
    resolver: zodResolver(loggedInName ? (signupAgencyOnlySchema as unknown as typeof signupSchema) : signupSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      agencyName: "",
      city: "",
      agencyPhone: "",
      brandColor: FALLBACK_BRAND,
      locale,
    },
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control }) as Values;

  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const onPickLogo = (file: File | undefined) => {
    setLogoError(undefined);
    if (!file) return;
    if (!(file.type in LOGO_TYPES)) return setLogoError("logoType");
    if (file.size > LOGO_MAX_BYTES) return setLogoError("logoSize");
    setLogo(file);
  };

  const goNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (!valid) return;
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    submit();
  };

  const submit = () => {
    setError(null);
    const v = form.getValues();
    const data = new FormData();
    for (const [key, value] of Object.entries(v)) data.set(key, String(value ?? ""));
    data.set("locale", locale);
    if (logo) data.set("logo", logo);
    startTransition(async () => {
      const result = await signupAction(data);
      if (result && !result.ok) {
        setError(result.error);
        const fields = result.fieldErrors ?? {};
        for (const [field, message] of Object.entries(fields)) {
          if (field === "logo") setLogoError(message);
          else form.setError(field as FieldPath<Values>, { message });
        }
        const firstStep = steps.findIndex((s) => STEP_FIELDS[s].some((f) => f in fields));
        if (firstStep >= 0) setIndex(firstStep);
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void goNext();
      }}
      className="flex flex-col gap-4 pb-24 sm:pb-0"
    >
      <StepIndicator steps={steps} index={index} label={(s) => t(`steps.${s}`)} counter={t("stepOf", { current: index + 1, total: steps.length })} />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6">
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
              {t(`${step}.title`)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {loggedInName && step === "agency" ? t("agency.subtitleLoggedIn", { name: loggedInName }) : t(`${step}.subtitle`)}
            </p>
          </div>

          {error ? <Alert variant="danger">{te(error)}</Alert> : null}

          {step === "account" ? (
            <>
              <Field id="fullName" label={t("account.fullName")} error={errors.fullName?.message}>
                <Input {...fieldAria("fullName", errors.fullName?.message)} autoComplete="name" {...form.register("fullName")} />
              </Field>
              <Field id="email" label={t("account.email")} error={errors.email?.message}>
                <Input {...fieldAria("email", errors.email?.message)} type="email" inputMode="email" autoComplete="email" {...form.register("email")} />
              </Field>
              <Field id="phone" label={t("account.phone")} hint={tv("phoneHint")} error={errors.phone?.message}>
                <Input
                  {...fieldAria("phone", errors.phone?.message, true)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="06 12 34 56 78"
                  {...form.register("phone")}
                />
              </Field>
              <Field id="password" label={t("account.password")} hint={tv("passwordRule")} error={errors.password?.message}>
                <PasswordInput {...fieldAria("password", errors.password?.message, true)} autoComplete="new-password" {...form.register("password")} />
              </Field>
            </>
          ) : null}

          {step === "agency" ? (
            <>
              <Field id="agencyName" label={t("agency.name")} error={errors.agencyName?.message}>
                <Input {...fieldAria("agencyName", errors.agencyName?.message)} autoComplete="organization" {...form.register("agencyName")} />
              </Field>
              <Field id="city" label={t("agency.city")} error={errors.city?.message}>
                <Input {...fieldAria("city", errors.city?.message)} autoComplete="address-level2" {...form.register("city")} />
              </Field>
              <Field id="agencyPhone" label={t("agency.phone")} hint={tv("phoneHint")} error={errors.agencyPhone?.message}>
                <Input
                  {...fieldAria("agencyPhone", errors.agencyPhone?.message, true)}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="05 22 00 00 00"
                  {...form.register("agencyPhone")}
                />
              </Field>
            </>
          ) : null}

          {step === "brand" ? (
            <div className="flex flex-col gap-4" style={brandVars(values.brandColor)}>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("brand.logo")}</span>
                <div className="flex flex-wrap items-center gap-3">
                  <AgencyLogo name={values.agencyName || "?"} url={logoPreview} size={64} />
                  <input
                    ref={logoInput}
                    id="logo"
                    type="file"
                    accept={Object.keys(LOGO_TYPES).join(",")}
                    className="sr-only"
                    aria-describedby="logo-hint"
                    onChange={(e) => onPickLogo(e.target.files?.[0])}
                  />
                  <Button type="button" variant="outline" onClick={() => logoInput.current?.click()}>
                    <ImageUpIcon aria-hidden />
                    {logo ? t("brand.changeLogo") : t("brand.addLogo")}
                  </Button>
                  {logo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setLogo(null);
                        if (logoInput.current) logoInput.current.value = "";
                      }}
                    >
                      <Trash2Icon aria-hidden />
                      {t("brand.removeLogo")}
                    </Button>
                  ) : null}
                </div>
                <p id="logo-hint" className="text-sm text-muted-foreground">
                  {t("brand.logoHint")}
                </p>
                {logoError ? (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {tv(logoError)}
                  </p>
                ) : null}
              </div>

              <ColorPicker
                value={values.brandColor}
                onChange={(c) => form.setValue("brandColor", c, { shouldValidate: true })}
                label={t("brand.color")}
                customLabel={t("brand.customColor")}
              />

              <HeaderPreview
                agencyName={values.agencyName}
                userName={loggedInName ?? values.fullName}
                logoUrl={logoPreview}
                color={values.brandColor}
                labels={{
                  preview: t("brand.preview"),
                  role: t("brand.previewRole"),
                  button: t("brand.previewButton"),
                  fallback: t("brand.tooLight"),
                }}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Sticky action bar on phones, inline from 640px */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-lg gap-2">
          {index > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => setIndex((i) => i - 1)} disabled={pending}>
              <ArrowLeftIcon className="rtl:rotate-180" aria-hidden />
              {t("back")}
            </Button>
          ) : null}
          <Button type="submit" size="lg" className="flex-1" disabled={pending}>
            {isLast ? <CheckIcon aria-hidden /> : null}
            {pending ? t("creating") : isLast ? t("create") : t("next")}
            {!isLast ? <ArrowRightIcon className="rtl:rotate-180" aria-hidden /> : null}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** CSS variables so everything inside previews the chosen (contrast-checked) colour. */
function StepIndicator({
  steps,
  index,
  label,
  counter,
}: {
  steps: StepId[];
  index: number;
  label: (s: StepId) => string;
  counter: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        {counter} · {label(steps[index])}
      </p>
      <ol className="flex gap-2" aria-hidden>
        {steps.map((s, i) => (
          <li key={s} className={cn("h-1.5 flex-1 rounded-full", i <= index ? "bg-primary dark:bg-ring" : "bg-border")} />
        ))}
      </ol>
    </div>
  );
}
