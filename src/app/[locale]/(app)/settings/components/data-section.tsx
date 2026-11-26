"use client";

import { FileSpreadsheetIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { deleteAgencyAction } from "../actions";
import { PrivacyTools } from "./privacy-tools";

/** Données: download everything, or delete the agency (admins). */
export function DataSection({ agencyName }: { agencyName: string }) {
  const t = useTranslations("settings.data");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === agencyName.trim().toLowerCase();

  const remove = () =>
    startTransition(async () => {
      const r = await deleteAgencyAction(typed);
      if (!r.ok) {
        setError(r.fieldErrors?.confirm);
        toast.error(te(r.error));
        return;
      }
      toast.success(t("deleted"));
      router.replace("/select-agency");
    });

  return (
    <div className="flex flex-col gap-6" data-testid="settings-data">
      <section aria-labelledby="export-title" className="flex flex-col gap-2">
        <h3 id="export-title" className="font-semibold">{t("exportTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("exportBody")}</p>
        <Button variant="outline" size="lg" asChild className="self-start">
          <a href="/api/export" download>
            <FileSpreadsheetIcon aria-hidden />
            {t("export")}
          </a>
        </Button>
      </section>

      <PrivacyTools />

      <section aria-labelledby="delete-title" className="flex flex-col gap-2 rounded-xl border border-destructive/40 p-4">
        <h3 id="delete-title" className="font-semibold text-destructive">{t("deleteTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("deleteBody")}</p>
        <Button variant="destructive" size="lg" className="self-start" onClick={() => setOpen(true)}>
          <Trash2Icon aria-hidden />
          {t("delete")}
        </Button>
      </section>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setTyped(""); setError(undefined); } }}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmBody")}</DialogDescription>
          </DialogHeader>
          <Alert variant="danger">{t("confirmWarning")}</Alert>
          <Field id="delete-confirm" label={t("typeName", { name: agencyName })} error={error}>
            <Input {...fieldAria("delete-confirm", error)} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" dir="auto" />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button variant="destructive" size="lg" disabled={!matches || pending} onClick={remove}>
              <Trash2Icon aria-hidden />
              {t("deleteForever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
