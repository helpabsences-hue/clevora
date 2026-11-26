"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPasswordAction } from "../actions";
import { newPasswordSchema, type NewPasswordInput } from "../schema";

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{te(error)}</Alert> : null}
      <Field id="password" label={t("password")} hint={tv("passwordRule")} error={errors.password?.message}>
        <PasswordInput {...fieldAria("password", errors.password?.message, true)} autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field id="confirm" label={t("confirm")} error={errors.confirm?.message}>
        <PasswordInput {...fieldAria("confirm", errors.confirm?.message)} autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        <KeyRoundIcon aria-hidden />
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
