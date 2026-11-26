"use client";

import { ShieldMinusIcon, ShieldPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { setPlatformAdminAction } from "../actions";

/** "Ajouter un admin Parcolia": the person must already have an account. */
export function AddPlatformAdmin() {
  const t = useTranslations("platform.users");
  const te = useTranslations("errors");
  const tv = useTranslations("validation");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await setPlatformAdminAction(email, true);
      if (!r.ok) return void setError(r.fieldErrors?.email ? (r.fieldErrors.email === "noAccount" ? t("noAccount") : tv(r.fieldErrors.email)) : te(r.error));
      toast.success(t("added"));
      setOpen(false);
      setEmail("");
      setError(null);
    });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ShieldPlusIcon aria-hidden />
        {t("addAdmin")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("addAdmin")}</DialogTitle>
            <DialogDescription>{t("addAdminBody")}</DialogDescription>
          </DialogHeader>
          <Field id="pa-email" label={t("email")} error={error ?? undefined}>
            <Input id="pa-email" type="email" dir="ltr" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button disabled={pending || !email} onClick={save} data-testid="add-admin-confirm">
              <ShieldPlusIcon aria-hidden />
              {t("addAdmin")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemovePlatformAdmin({ email, self }: { email: string; self: boolean }) {
  const t = useTranslations("platform.users");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  if (self) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!window.confirm(t("removeConfirm", { email }))) return;
          const r = await setPlatformAdminAction(email, false);
          if (!r.ok) return void toast.error(te(r.error));
          toast.success(t("removed"));
        })
      }
    >
      <ShieldMinusIcon aria-hidden />
      {t("removeAdmin")}
    </Button>
  );
}
