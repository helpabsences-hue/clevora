"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogInIcon, UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { acceptInviteSchema, type AcceptInviteInput } from "../../schema";
import { acceptInviteAction, acceptInviteNewAccountAction } from "./actions";

export function InviteForms({
  token,
  locale,
  loggedIn,
  invitedEmail,
}: {
  token: string;
  locale: Locale;
  loggedIn: boolean;
  invitedEmail: string | null;
}) {
  const t = useTranslations("auth.invite");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token, fullName: "", phone: "", email: invitedEmail ?? "", password: "", locale },
  });
  const { errors } = form.formState;

  if (loggedIn) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {error ? <Alert variant="danger">{te(error)}</Alert> : null}
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await acceptInviteAction(token, locale);
                if (result && !result.ok) setError(result.error);
              })
            }
          >
            <LogInIcon aria-hidden />
            {pending ? t("joining") : t("join")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteNewAccountAction({ ...values, email: invitedEmail ?? values.email });
      if (result && !result.ok) {
        setError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof AcceptInviteInput, { message });
        }
      }
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("createAccount")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error ? (
            <Alert variant="danger">
              <span>
                {te(error)}{" "}
                {error === "accountExists" ? (
                  <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="font-semibold underline">
                    {t("loginInstead")}
                  </Link>
                ) : null}
              </span>
            </Alert>
          ) : null}
          <Field id="email" label={t("email")} hint={invitedEmail ? t("emailLocked") : undefined} error={errors.email?.message}>
            <Input
              {...fieldAria("email", errors.email?.message, Boolean(invitedEmail))}
              type="email"
              inputMode="email"
              autoComplete="email"
              readOnly={Boolean(invitedEmail)}
              className={invitedEmail ? "bg-muted" : undefined}
              {...form.register("email")}
            />
          </Field>
          <Field id="fullName" label={t("fullName")} error={errors.fullName?.message}>
            <Input {...fieldAria("fullName", errors.fullName?.message)} autoComplete="name" {...form.register("fullName")} />
          </Field>
          <Field id="phone" label={t("phone")} hint={tv("phoneHint")} error={errors.phone?.message}>
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
          <Field id="password" label={t("password")} hint={tv("passwordRule")} error={errors.password?.message}>
            <PasswordInput {...fieldAria("password", errors.password?.message, true)} autoComplete="new-password" {...form.register("password")} />
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            <UserPlusIcon aria-hidden />
            {pending ? t("joining") : t("createAndJoin")}
          </Button>
          <p className="text-center text-sm">
            {t("haveAccount")}{" "}
            <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="font-semibold text-primary underline-offset-4 hover:underline dark:text-foreground">
              {t("loginInstead")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
