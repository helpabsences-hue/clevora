"use client";

import { CheckIcon, DropletIcon, GaugeIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Can, useAgency } from "@/components/app/agency-context";
import { RowMenu } from "@/components/app/row-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DateField, MoneyField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Ltr } from "@/components/app/ltr";
import { dayKey, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { recordOilChangeAction, updateKmAction } from "./actions";
import { OIL_ITEMS, type OilItem } from "./schema";

const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");
const digits = (s: string) => s.replace(/\D/g, "");

export function OilActions({
  vehicleId,
  label,
  currentKm,
  lastInterval,
  compact = false,
  urgent = true,
}: {
  vehicleId: string;
  label: string;
  currentKm: number;
  /** km between the last two oil changes of this car (a suggestion, never applied automatically) */
  lastInterval: number | null;
  /** Table row: "Vidange faite" + a "⋯" menu for the km. */
  compact?: boolean;
  /** Due or soon: the main button is filled, otherwise outlined. */
  urgent?: boolean;
}) {
  const t = useTranslations("oil");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tv = useTranslations("validation");
  const { writable, role } = useAgency();
  const [open, setOpen] = useState<"oil" | "km" | null>(null);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(dayKey(new Date()));
  const [km, setKm] = useState(String(currentKm));
  const [nextKm, setNextKm] = useState("");
  const [items, setItems] = useState<OilItem[]>(["huile", "filtre_huile"]);
  const [prices, setPrices] = useState<Partial<Record<OilItem, number | null>>>({});
  const [note, setNote] = useState("");
  const toggle = (item: OilItem) => setItems((list) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]));
  const total = items.reduce((sum, i) => sum + (prices[i] ?? 0), 0);
  const [newKm, setNewKm] = useState(String(currentKm));
  const [error, setError] = useState<string | null>(null);

  const saveOil = () =>
    startTransition(async () => {
      const r = await recordOilChangeAction(vehicleId, {
        date,
        km: Number(km),
        next_km: Number(nextKm),
        items: items.map((item) => ({ item, price: role === "admin" ? (prices[item] ?? null) : null })),
        note,
      });
      if (!r.ok) {
        const field = r.fieldErrors?.next_km ?? r.fieldErrors?.items ?? r.fieldErrors?.note;
        setError(field ? tv(field) : te(r.error));
        return;
      }
      toast.success(t("done"));
      setOpen(null);
    });
  const saveKm = () =>
    startTransition(async () => {
      const r = await updateKmAction(vehicleId, Number(newKm));
      if (!r.ok) return void toast.error(te(r.error));
      toast.success(t("kmSaved"));
      setOpen(null);
    });

  return (
    <div className={compact ? "flex items-center gap-1" : "flex flex-wrap items-center gap-2"}>
      <Button size="sm" variant={urgent ? "default" : "outline"} onClick={() => setOpen("oil")} disabled={!writable}>
        <DropletIcon aria-hidden />
        {t("done_button")}
      </Button>
      {compact ? (
        <RowMenu label={t("menu", { car: label })} items={[{ label: t("updateKm"), icon: GaugeIcon, onSelect: () => setOpen("km"), disabled: !writable }]} />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen("km")} disabled={!writable}>
          <GaugeIcon aria-hidden />
          {t("updateKm")}
        </Button>
      )}

      <Dialog open={open === "oil"} onOpenChange={(o) => setOpen(o ? "oil" : null)}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("doneTitle")}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`oil-date-${vehicleId}`} label={t("date")}>
              <DateField id={`oil-date-${vehicleId}`} value={date} onChange={setDate} />
            </Field>
            <Field id={`oil-km-${vehicleId}`} label={t("kmAtChange")}>
              <Input id={`oil-km-${vehicleId}`} inputMode="numeric" dir="ltr" value={km} onChange={(e) => setKm(digits(e.target.value))} />
            </Field>
            <Field id={`oil-next-${vehicleId}`} label={t("nextKm")} className="sm:col-span-2" hint={t("nextKmHint")}>
              <Input id={`oil-next-${vehicleId}`} inputMode="numeric" dir="ltr" value={nextKm} onChange={(e) => setNextKm(digits(e.target.value))} />
            </Field>
            {lastInterval && km ? (
              <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-start sm:col-span-2" onClick={() => setNextKm(String(Number(km) + lastInterval))}>
                <CheckIcon aria-hidden />
                {t("suggestion", { km: nf(Number(km) + lastInterval), interval: nf(lastInterval) })}
              </Button>
            ) : null}
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">{t("itemsTitle")}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="oil-items">
                {OIL_ITEMS.map((item) => {
                  const on = items.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(item)}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 text-start text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on ? "border-primary bg-primary/10 dark:border-ring" : "border-border bg-card hover:bg-accent",
                      )}
                    >
                      <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")} aria-hidden>
                        {on ? <CheckIcon className="size-3.5" /> : null}
                      </span>
                      {t(`items.${item}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {items.includes("autre") ? (
              <Field id={`oil-note-${vehicleId}`} label={t("otherWhat")} className="sm:col-span-2">
                <Input id={`oil-note-${vehicleId}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
              </Field>
            ) : null}
            <Can role="admin">
              {items.length ? (
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:col-span-2" data-testid="oil-prices">
                  <p className="text-sm font-medium">{t("pricesTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("pricesHint")}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {OIL_ITEMS.filter((i) => items.includes(i)).map((item) => (
                      <Field key={item} id={`oil-price-${vehicleId}-${item}`} label={item === "autre" && note ? note : t(`items.${item}`)}>
                        <MoneyField id={`oil-price-${vehicleId}-${item}`} value={prices[item] ?? null} onChange={(v) => setPrices((p) => ({ ...p, [item]: v }))} />
                      </Field>
                    ))}
                  </div>
                  {total > 0 ? (
                    <p className="text-sm font-semibold" data-testid="oil-total">
                      {t("pricesTotal")} <Ltr>{formatMoney(total)}</Ltr>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Can>
            {error ? <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button size="lg" onClick={saveOil} disabled={pending || !km || !nextKm || items.length === 0}>
              <SaveIcon aria-hidden />
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "km"} onOpenChange={(o) => setOpen(o ? "km" : null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("updateKm")}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <Field id={`km-${vehicleId}`} label={t("currentKm")}>
            <Input id={`km-${vehicleId}`} inputMode="numeric" dir="ltr" value={newKm} onChange={(e) => setNewKm(digits(e.target.value))} />
          </Field>
          <DialogFooter>
            <Button size="lg" onClick={saveKm} disabled={pending || !newKm}>
              <SaveIcon aria-hidden />
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
