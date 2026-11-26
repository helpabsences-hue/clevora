"use client";

import { BanknoteIcon, CheckIcon, LandmarkIcon, ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ltr } from "@/components/app/ltr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestPlanAction } from "../actions";

export type PlanCard = {
  code: "essentiel" | "pro" | "illimite";
  name: string;
  month: number;
  year: number;
  maxVehicles: number | null;
  maxUsers: number | null;
  ai: boolean;
  aiQuestions: number | null;
};

type Method = "virement" | "especes" | "cheque";

/** Plan cards with a Mensuel / Annuel switch; choosing one opens the payment dialog. */
export function PlanPicker({ plans, currentCode, active }: { plans: PlanCard[]; currentCode: string | null; active: boolean }) {
  const t = useTranslations("billing");
  const te = useTranslations("errors");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [chosen, setChosen] = useState<PlanCard | null>(null);
  const [method, setMethod] = useState<Method>("virement");
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      if (!chosen) return;
      const r = await requestPlanAction({ plan: chosen.code, period, method });
      if (!r.ok) {
        toast.error(te(r.error));
        return;
      }
      toast.success(t("requested"));
      setChosen(null);
    });

  return (
    <div className="flex flex-col gap-4">
      <ChoiceChips
        name="period"
        label={t("period")}
        value={period}
        onChange={setPeriod}
        className="max-w-md grid-cols-2"
        options={[
          { value: "month", label: t("monthly") },
          { value: "year", label: t("yearly"), description: t("yearlyHint") },
        ]}
      />
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = p.code === currentCode && active;
          const price = period === "year" ? p.year : p.month;
          return (
            <li key={p.code} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", p.code === "pro" && "border-primary ring-1 ring-primary")} data-testid={`plan-${p.code}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{p.name}</h3>
                {current ? <Badge variant="success">{t("current")}</Badge> : p.code === "pro" ? <Badge variant="info">{t("popular")}</Badge> : null}
              </div>
              <p>
                <span className="text-2xl font-bold"><Ltr>{formatMoney(price)}</Ltr></span>{" "}
                <span className="text-sm text-muted-foreground">{period === "year" ? t("perYear") : t("perMonth")}</span>
              </p>
              <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                {[
                  p.maxVehicles === null ? t("features.carsUnlimited") : t("features.cars", { count: p.maxVehicles }),
                  p.maxUsers === null ? t("features.usersUnlimited") : t("features.users", { count: p.maxUsers }),
                  t("features.contracts"),
                  p.ai ? t("features.ai", { count: p.aiQuestions ?? 0 }) : null,
                ]
                  .filter(Boolean)
                  .map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      {f}
                    </li>
                  ))}
              </ul>
              <Button size="lg" variant={p.code === "pro" ? "default" : "outline"} onClick={() => setChosen(p)}>
                <ReceiptTextIcon aria-hidden />
                {current ? t("renew") : t("choose", { plan: p.name })}
              </Button>
            </li>
          );
        })}
      </ul>

      <Dialog open={chosen !== null} onOpenChange={(o) => !o && setChosen(null)}>
        <DialogContent closeLabel={t("close")}>
          <DialogHeader>
            <DialogTitle>{chosen ? t("payTitle", { plan: chosen.name }) : ""}</DialogTitle>
            <DialogDescription>
              {chosen ? (
                <>
                  {period === "year" ? t("payYear") : t("payMonth")} · <Ltr>{formatMoney(period === "year" ? chosen.year : chosen.month)}</Ltr>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("howPay")}</span>
            <ChoiceChips
              name="method"
              label={t("howPay")}
              value={method}
              onChange={setMethod}
              className="sm:grid-cols-3"
              options={[
                { value: "virement", label: t("methods.virement"), icon: <LandmarkIcon className="size-4" aria-hidden /> },
                { value: "especes", label: t("methods.especes"), icon: <BanknoteIcon className="size-4" aria-hidden /> },
                { value: "cheque", label: t("methods.cheque"), icon: <ReceiptTextIcon className="size-4" aria-hidden /> },
              ]}
            />
            <p className="text-sm text-muted-foreground">{t("payHint")}</p>
          </div>
          <DialogFooter>
            <Button size="lg" onClick={confirm} disabled={pending}>
              <CheckIcon aria-hidden />
              {t("confirmRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
