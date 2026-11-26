"use client";

import { ArchiveIcon, ArchiveRestoreIcon, MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "@/i18n/navigation";
import { deleteVehicleAction, setVehicleSoldAction } from "../actions";

/** Admins: mark as sold / back in the fleet, or delete (only cars without history). */
export function AdminVehicleMenu({ vehicleId, sold }: { vehicleId: string; sold: boolean }) {
  const t = useTranslations("fleet.actions");
  const te = useTranslations("errors");
  const tn = useTranslations("notices");
  const { writable } = useAgency();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("more")} disabled={!writable}>
            <MoreVerticalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              startTransition(async () => {
                const r = await setVehicleSoldAction(vehicleId, !sold);
                if (r.ok) toast.success(tn("saved"));
                else toast.error(te(r.error));
              })
            }
          >
            {sold ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
            {sold ? t("unsell") : t("sell")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2Icon aria-hidden />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={t("delete")}
        confirmIcon={<Trash2Icon aria-hidden />}
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const r = await deleteVehicleAction(vehicleId);
            setConfirm(false);
            if (!r.ok) return void toast.error(te(r.error));
            toast.success(tn("saved"));
            router.push("/fleet");
          })
        }
      />
    </>
  );
}
