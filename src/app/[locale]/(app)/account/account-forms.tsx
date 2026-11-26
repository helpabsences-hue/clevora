"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon, LaptopIcon, MoonIcon, SaveIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import type { ActionResult } from "@/lib/action-result";
import { changePasswordAction, updatePreferencesAction, updateProfileAction } from "./actions";
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordInput,
  type PreferencesInput,
  type ProfileInput,
} from "./schema";

function useResultHandler() {
  const te = useTranslations("errors");
  const tn = useTranslations("notices");
  return (result: ActionResult | undefined, onFieldError?: (field: string, message: string) => void) => {
    if (!result) return;
    if (result.ok) {
      toast.success(tn("saved"));
      return;
    }
    if (result.fieldErrors && onFieldError) {
      for (const [field, message] of Object.entries(result.fieldErrors)) onFieldError(field, message);
    }
    if (result.error !== "invalidForm" || !result.fieldErrors) toast.error(te(result.error));
  };
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const t = useTranslations("account.profile");
  const tv = useTranslations("validation");
  const handle = useResultHandler();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProfileInput, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName, phone },
  });
  const { errors } = form.formState;

  // The server action validates the raw input again with the same schema.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      handle(await updateProfileAction(form.getValues()), (f, m) => form.setError(f as keyof ProfileInput, { message: m }));
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="fullName" label={t("fullName")} error={errors.fullName?.message}>
        <Input {...fieldAria("fullName", errors.fullName?.message)} autoComplete="name" {...form.register("fullName")} />
      </Field>
      <Field id="phone" label={t("phone")} hint={tv("phoneHint")} error={errors.phone?.message}>
        <Input
          {...fieldAria("phone", errors.phone?.message, true)}
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          {...form.register("phone")}
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        <SaveIcon aria-hidden />
        {t("save")}
      </Button>
    </form>
  );
}

export function PreferencesForm({ locale, theme }: PreferencesInput) {
  const t = useTranslations("account.preferences");
  const handle = useResultHandler();
  const { setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<PreferencesInput>({ locale, theme });

  const save = () =>
    startTransition(async () => {
      setTheme(values.theme);
      handle(await updatePreferencesAction(values));
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("language")}</span>
        <ChoiceChips
          name="locale"
          label={t("language")}
          value={values.locale}
          onChange={(v) => setValues((s) => ({ ...s, locale: v }))}
          className="sm:grid-cols-3"
          options={[
            { value: "fr", label: "Français" },
            { value: "ar", label: "العربية" },
            { value: "en", label: "English" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("theme")}</span>
        <ChoiceChips
          name="theme"
          label={t("theme")}
          value={values.theme}
          onChange={(v) => setValues((s) => ({ ...s, theme: v }))}
          className="sm:grid-cols-3"
          options={[
            { value: "light", label: t("light"), icon: <SunIcon className="size-4" aria-hidden /> },
            { value: "dark", label: t("dark"), icon: <MoonIcon className="size-4" aria-hidden /> },
            { value: "system", label: t("system"), icon: <LaptopIcon className="size-4" aria-hidden /> },
          ]}
        />
      </div>
      <Button type="button" size="lg" disabled={pending} onClick={save} className="self-start">
        <SaveIcon aria-hidden />
        {t("save")}
      </Button>
    </div>
  );
}

export function PasswordForm() {
  const t = useTranslations("account.password");
  const tv = useTranslations("validation");
  const handle = useResultHandler();
  const [pending, startTransition] = useTransition();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: "", password: "", confirm: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await changePasswordAction(values);
      handle(result, (f, m) => form.setError(f as keyof ChangePasswordInput, { message: m }));
      if (result.ok) form.reset();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="current" label={t("current")} error={errors.current?.message}>
        <PasswordInput {...fieldAria("current", errors.current?.message)} autoComplete="current-password" {...form.register("current")} />
      </Field>
      <Field id="newPassword" label={t("new")} hint={tv("passwordRule")} error={errors.password?.message}>
        <PasswordInput {...fieldAria("newPassword", errors.password?.message, true)} autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field id="confirm" label={t("confirm")} error={errors.confirm?.message}>
        <PasswordInput {...fieldAria("confirm", errors.confirm?.message)} autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        <KeyRoundIcon aria-hidden />
        {t("save")}
      </Button>
    </form>
  );
}
