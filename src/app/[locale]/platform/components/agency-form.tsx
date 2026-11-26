"use client";

import { SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/fields";
import { updateAgencyAction } from "../actions";

type Values = { id: string; plan: "essentiel" | "pro" | "illimite"; status: "trial" | "active" | "past_due" | "suspended" | "cancelled"; trial_ends_on: string; period_ends_on: string };

const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base";

/** Parcolia: change an agency's plan, status and dates by hand. */
export function PlatformAgencyForm({ values }: { values: Values }) {
  const t = useTranslations("platform");
  const tn = useTranslations("notices");
  const te = useTranslations("errors");
  const [v, setV] = useState(values);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      data-testid="platform-agency-form"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateAgencyAction(v);
          if (r.ok) toast.success(tn("saved"));
          else toast.error(te(r.error));
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-plan" label={t("plan")}>
          <select id="p-plan" className={select} value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value as Values["plan"] })}>
            <option value="essentiel">Essentiel</option>
            <option value="pro">Pro</option>
            <option value="illimite">Illimité</option>
          </select>
        </Field>
        <Field id="p-status" label={t("status")}>
          <select id="p-status" className={select} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Values["status"] })}>
            {(["trial", "active", "past_due", "suspended", "cancelled"] as const).map((s) => (
              <option key={s} value={s}>{t(`statuses.${s}`)}</option>
            ))}
          </select>
        </Field>
        <Field id="p-trial" label={t("trialEnds")}>
          <DateField id="p-trial" value={v.trial_ends_on} onChange={(d) => setV({ ...v, trial_ends_on: d })} />
        </Field>
        <Field id="p-period" label={t("periodEnds")}>
          <DateField id="p-period" value={v.period_ends_on} onChange={(d) => setV({ ...v, period_ends_on: d })} />
        </Field>
      </div>
      <Button type="submit" size="lg" className="self-start" disabled={pending}>
        <SaveIcon aria-hidden />
        {t("save")}
      </Button>
    </form>
  );
}
