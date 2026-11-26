"use client";

import { PenLineIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signReservationAction } from "../../reservations/actions";

/** « Marquer comme signé » : the only action of the contract (the rest is on the reservation). */
export function SignButton({ id, disabled, title }: { id: string; disabled?: boolean; title?: string }) {
  const t = useTranslations("reservations.actions");
  const te = useTranslations("errors");
  const router = useRouter();
  const { writable } = useAgency();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      disabled={!writable || pending || disabled}
      title={title}
      data-testid="sign-contract"
      onClick={() =>
        start(async () => {
          const r = await signReservationAction(id);
          if (!r.ok) return void toast.error(te(r.error));
          toast.success(t("signed"));
          router.refresh();
        })
      }
    >
      <PenLineIcon aria-hidden />
      {t("sign")}
    </Button>
  );
}
