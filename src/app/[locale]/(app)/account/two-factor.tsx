"use client";

import { ShieldCheckIcon, ShieldOffIcon, SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { confirmMfaAction, disableMfaAction, enrollMfaAction } from "@/lib/auth/mfa";

/** Mon compte: turn two-step login on (QR code + first code) or off. */
export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const t = useTranslations("account.mfa");
  const te = useTranslations("errors");
  const router = useRouter();
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [confirmOff, setConfirmOff] = useState(false);
  const [pending, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      const r = await enrollMfaAction();
      if (r.ok) setSetup(r.data);
      else toast.error(te(r.error));
    });
  const confirm = () =>
    startTransition(async () => {
      if (!setup) return;
      const r = await confirmMfaAction(setup.factorId, code);
      if (!r.ok) {
        setError(r.fieldErrors?.code ?? te(r.error));
        return;
      }
      toast.success(t("enabledToast"));
      setSetup(null);
      setCode("");
      router.refresh();
    });
  const disable = () =>
    startTransition(async () => {
      const r = await disableMfaAction();
      setConfirmOff(false);
      if (r.ok) {
        toast.success(t("disabledToast"));
        router.refresh();
      } else toast.error(te(r.error));
    });

  if (enabled) {
    return (
      <div className="flex flex-col gap-4" data-testid="mfa-card">
        <Alert variant="success">
          <ShieldCheckIcon aria-hidden />
          {t("on")}
        </Alert>
        <Button variant="outline" size="lg" className="self-start" onClick={() => setConfirmOff(true)} disabled={pending}>
          <ShieldOffIcon aria-hidden />
          {t("disable")}
        </Button>
        <ConfirmDialog
          open={confirmOff}
          onOpenChange={setConfirmOff}
          title={t("disableTitle")}
          description={t("disableBody")}
          confirmLabel={t("disable")}
          confirmIcon={<ShieldOffIcon aria-hidden />}
          destructive
          pending={pending}
          onConfirm={disable}
        />
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-4" data-testid="mfa-card">
        <p className="text-sm text-muted-foreground">{t("explain")}</p>
        <Button size="lg" className="self-start" onClick={start} disabled={pending}>
          <SmartphoneIcon aria-hidden />
          {t("enable")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="mfa-card">
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URI from Supabase */}
      <img src={setup.qrCode} alt={t("qrAlt")} className="size-44 self-center rounded-lg border bg-white p-2" />
      <p className="text-center text-xs text-muted-foreground">
        {t("secret")} <code className="break-all font-mono text-foreground" dir="ltr" data-testid="mfa-secret">{setup.secret}</code>
      </p>
      <Field id="mfa-setup-code" label={t("code")} error={error}>
        <Input
          {...fieldAria("mfa-setup-code", error)}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          className="text-center text-xl tracking-[0.4em]"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={confirm} disabled={pending || code.length !== 6}>
          <ShieldCheckIcon aria-hidden />
          {t("confirm")}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setSetup(null)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
