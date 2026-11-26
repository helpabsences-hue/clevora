"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "../actions";
import { emailOnlySchema, type EmailOnlyInput } from "../schema";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  });

  if (sent) {
    return (
      <Alert variant="success">
        <MailIcon aria-hidden />
        <span>{t("sent")}</span>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{te(error)}</Alert> : null}
      <Field id="email" label={t("email")} error={errors.email?.message}>
        <Input {...fieldAria("email", errors.email?.message)} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        <SendIcon aria-hidden />
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
