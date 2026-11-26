"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogInIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Link } from "@/i18n/navigation";
import { loginAction, magicLinkAction } from "../actions";
import { emailOnlySchema, loginSchema, type EmailOnlyInput, type LoginInput } from "../schema";

export function LoginForm({ next }: { next: string | null }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  return mode === "password" ? (
    <PasswordLogin next={next} onMagic={() => setMode("magic")} />
  ) : (
    <MagicLinkLogin onPassword={() => setMode("password")} />
  );
}

function PasswordLogin({ next, onMagic }: { next: string | null; onMagic: () => void }) {
  const t = useTranslations("auth.login");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(values, next);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{te(error)}</Alert> : null}
      <Field id="email" label={t("email")} error={errors.email?.message}>
        <Input
          {...fieldAria("email", errors.email?.message)}
          type="email"
          autoComplete="email"
          inputMode="email"
          {...form.register("email")}
        />
      </Field>
      <Field id="password" label={t("password")} error={errors.password?.message}>
        <PasswordInput
          {...fieldAria("password", errors.password?.message)}
          autoComplete="current-password"
          {...form.register("password")}
        />
      </Field>
      <div className="-mt-1 flex justify-end">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline dark:text-foreground"
        >
          {t("forgot")}
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        <LogInIcon aria-hidden />
        {pending ? t("submitting") : t("submit")}
      </Button>
      <Button type="button" variant="outline" size="lg" onClick={onMagic}>
        <MailIcon aria-hidden />
        {t("magicLink")}
      </Button>
    </form>
  );
}

function MagicLinkLogin({ onPassword }: { onPassword: () => void }) {
  const t = useTranslations("auth.login");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await magicLinkAction(values);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  });

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          <MailIcon aria-hidden />
          <span>{t("magicLinkSent")}</span>
        </Alert>
        <Button type="button" variant="outline" size="lg" onClick={onPassword}>
          {t("backToPassword")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("magicLinkHelp")}</p>
      {error ? <Alert variant="danger">{te(error)}</Alert> : null}
      <Field id="magic-email" label={t("email")} error={errors.email?.message}>
        <Input
          {...fieldAria("magic-email", errors.email?.message)}
          type="email"
          autoComplete="email"
          inputMode="email"
          {...form.register("email")}
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        <MailIcon aria-hidden />
        {pending ? t("submitting") : t("sendMagicLink")}
      </Button>
      <Button type="button" variant="ghost" size="lg" onClick={onPassword}>
        {t("backToPassword")}
      </Button>
    </form>
  );
}
