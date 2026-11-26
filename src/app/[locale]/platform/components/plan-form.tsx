"use client";

import { SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { savePlanAction, type PlanInput } from "../actions";

const intOrNull = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d ? Number(d) : null;
};

/** One plan: name, prices, limits (empty = unlimited), AI, shown on the site or not. */
export function PlanForm({ plan }: { plan: PlanInput & { code: string } }) {
  const t = useTranslations("platform.plans");
  const te = useTranslations("errors");
  const [v, setV] = useState(plan);
  const [pending, start] = useTransition();
  const id = (k: string) => `${plan.code}-${k}`;
  const set = <K extends keyof PlanInput>(k: K, value: PlanInput[K]) => setV((p) => ({ ...p, [k]: value }));
  const save = () =>
    start(async () => {
      const { code: _code, ...input } = v;
      void _code;
      const r = await savePlanAction(input);
      if (!r.ok) return void toast.error(te(r.error));
      toast.success(t("saved", { name: v.name }));
    });
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid={`plan-${plan.code}`}>
      <Field id={id("name")} label={t("name")} className="sm:col-span-2">
        <Input id={id("name")} value={v.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field id={id("month")} label={t("priceMonth")}>
        <MoneyField id={id("month")} value={v.price_mad_month} onChange={(n) => set("price_mad_month", n ?? 0)} />
      </Field>
      <Field id={id("year")} label={t("priceYear")} hint={t("priceYearHint")}>
        <MoneyField id={id("year")} value={v.price_mad_year} onChange={(n) => set("price_mad_year", n ?? 0)} />
      </Field>
      <Field id={id("cars")} label={t("maxCars")} hint={t("unlimitedHint")}>
        <Input id={id("cars")} inputMode="numeric" dir="ltr" value={v.max_vehicles ?? ""} onChange={(e) => set("max_vehicles", intOrNull(e.target.value))} />
      </Field>
      <Field id={id("users")} label={t("maxUsers")} hint={t("unlimitedHint")}>
        <Input id={id("users")} inputMode="numeric" dir="ltr" value={v.max_users ?? ""} onChange={(e) => set("max_users", intOrNull(e.target.value))} />
      </Field>
      <div className="sm:col-span-2">
        <ChoiceChips name={id("ai")} label={t("ai")} value={v.ai_enabled ? "yes" : "no"} onChange={(x) => set("ai_enabled", x === "yes")} options={[{ value: "yes", label: t("yes") }, { value: "no", label: t("no") }]} />
      </div>
      {v.ai_enabled ? (
        <Field id={id("aiq")} label={t("aiQuestions")} hint={t("unlimitedHint")} className="sm:col-span-2">
          <Input id={id("aiq")} inputMode="numeric" dir="ltr" value={v.ai_monthly_questions ?? ""} onChange={(e) => set("ai_monthly_questions", intOrNull(e.target.value))} />
        </Field>
      ) : null}
      <div className="sm:col-span-2">
        <ChoiceChips name={id("active")} label={t("active")} value={v.active ? "yes" : "no"} onChange={(x) => set("active", x === "yes")} options={[{ value: "yes", label: t("activeYes") }, { value: "no", label: t("activeNo") }]} />
      </div>
      <div className="sm:col-span-2">
        <Button size="lg" onClick={save} disabled={pending}>
          <SaveIcon aria-hidden />
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
