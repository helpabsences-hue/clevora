"use client";

import { LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { verifyLoginCodeAction } from "@/lib/auth/mfa";
import { logoutAction } from "../actions";

/** Login step 2: the 6-digit code from the authenticator app. */
export function MfaForm({ next }: { next: string | null }) {
  const t = useTranslations("auth.mfa");
  const te = useTranslations("errors");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await verifyLoginCodeAction(code, next);
      if (r && !r.ok) {
        setError(r.fieldErrors?.code ?? te(r.error));
        setCode("");
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field id="mfa-code" label={t("code")} hint={t("codeHint")} error={error}>
        <Input
          {...fieldAria("mfa-code", error, true)}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          dir="ltr"
          className="text-center text-2xl tracking-[0.5em]"
          maxLength={6}
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
        <ShieldCheckIcon aria-hidden />
        {t("verify")}
      </Button>
      <Button type="button" variant="ghost" onClick={() => startTransition(() => logoutAction())}>
        <LogOutIcon aria-hidden />
        {t("logout")}
      </Button>
    </form>
  );
}
