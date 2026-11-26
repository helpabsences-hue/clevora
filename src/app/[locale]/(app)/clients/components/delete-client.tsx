"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { deleteClientAction } from "../actions";

/** Admins: delete a client who never rented (a mistake, a duplicate). */
export function DeleteClient({ id, name }: { id: string; name: string }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
        <Trash2Icon aria-hidden />
        {t("delete")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle", { name })}</DialogTitle>
            <DialogDescription>{t("deleteBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteClientAction(id);
                  if (!r.ok) return void toast.error(te(r.error));
                  toast.success(t("deleted"));
                  router.push("/clients");
                })
              }
            >
              <Trash2Icon aria-hidden />
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
