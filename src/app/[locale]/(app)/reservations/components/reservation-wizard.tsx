"use client";

import { ArrowLeftIcon, ArrowRightIcon, CalendarClockIcon, CarIcon, CheckIcon, FileClockIcon, FuelIcon, ReceiptTextIcon, RotateCcwIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Arrow, Ltr } from "@/components/app/ltr";
import { StickyActionBar, Stepper } from "@/components/app/stepper";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DateField, MoneyField, TimeField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { YesNo, YesNoRow } from "@/components/ui/yes-no";
import { useRouter } from "@/i18n/navigation";
import { zodFieldErrors } from "@/lib/action-result";
import { formatDate, formatMoney } from "@/lib/format";
import { rentalDays } from "@/lib/revenue";
import { cn } from "@/lib/utils";
import { useAgency } from "@/components/app/agency-context";
import { availabilityAction, contractNumberTakenAction, saveReservationAction, type AvailableCar } from "../actions";
import { useReservationDraft } from "./use-draft";
import type { BookingSettings } from "../queries";
import { EMPTY_DRIVER, PAYMENT_METHODS, reservationSchema, type ReservationInput } from "../schema";
import { DriverFields } from "./driver-fields";

const STEP_FIELDS: string[][] = [
  ["contract_number", "start_date", "start_time", "end_date", "end_time", "vehicle_id", "car_later"],
  ["driver1", "has_driver2", "driver2"],
  ["daily_price", "delivery", "delivery_place", "return_place", "delivery_fee", "advance_amount", "advance_method", "franchise", "deposit_taken", "deposit_amount", "deposit_method"],
  ["km_out", "fuel_out", "equipment", "documents_given", "notes"],
];

export function ReservationWizard({
  reservationId,
  initial,
  initialCar,
  contractPlaceholder,
  settings,
  initialStep = 0,
}: {
  initialStep?: number;
  reservationId?: string;
  initial: ReservationInput;
  initialCar?: AvailableCar | null;
  contractPlaceholder: string;
  settings: BookingSettings;
}) {
  const t = useTranslations("reservations.wizard");
  const tp = useTranslations("reservations.payment");
  const tf = useTranslations("fleet");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState(Math.min(3, Math.max(0, initialStep)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cars, setCars] = useState<AvailableCar[] | null>(initialCar ? [initialCar] : null);
  const [unavailable, setUnavailable] = useState({ booked: 0, maintenance: 0, insurance: 0 });
  const [loadingCars, setLoadingCars] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const priceTouched = useRef(Boolean(reservationId));
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<ReservationInput>({ defaultValues: initial });
  const v = useWatch({ control: form.control }) as ReservationInput;

  // Brouillon (new reservations only): offered back after a reload or a lost connection.
  const { id: agencyId } = useAgency();
  const { draft, save: saveDraft, clear: clearDraft } = useReservationDraft(agencyId, !reservationId);
  const [draftDecided, setDraftDecided] = useState(false);
  const touched = form.formState.isDirty;
  useEffect(() => {
    if (!reservationId && touched) saveDraft(form.getValues(), step);
  }, [v, step, touched, reservationId, saveDraft, form]);
  const resumeDraft = () => {
    if (!draft) return;
    form.reset(draft.values, { keepDefaultValues: true });
    priceTouched.current = true;
    setStep(Math.min(3, Math.max(0, draft.step)));
    setDraftDecided(true);
  };
  const discardDraft = () => {
    clearDraft();
    setDraftDecided(true);
  };

  const steps = [t("steps.dates"), t("steps.client"), t("steps.price"), t("steps.checkout")];

  // Available cars for the chosen dates
  useEffect(() => {
    if (!v.start_date || !v.end_date || !v.start_time || !v.end_time) return;
    if (`${v.end_date}T${v.end_time}` <= `${v.start_date}T${v.start_time}`) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingCars(true);
      const res = await availabilityAction({ date: v.start_date, time: v.start_time }, { date: v.end_date, time: v.end_time }, reservationId);
      if (cancelled) return;
      setLoadingCars(false);
      if (!res.ok) return;
      setCars(res.data.available);
      setUnavailable(res.data.unavailable);
      if (v.vehicle_id && !res.data.available.some((c) => c.id === v.vehicle_id)) form.setValue("vehicle_id", "");
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [v.start_date, v.start_time, v.end_date, v.end_time, v.vehicle_id, reservationId, form]);

  const car = cars?.find((c) => c.id === v.vehicle_id) ?? (initialCar?.id === v.vehicle_id ? initialCar : null);
  const days = useMemo(() => {
    if (!v.start_date || !v.end_date) return 0;
    // Naive instants: only the difference matters (no time-zone maths in the browser).
    const s = `${v.start_date}T${v.start_time || "00:00"}:00Z`;
    const e = `${v.end_date}T${v.end_time || "00:00"}:00Z`;
    return e > s ? rentalDays(s, e) : 0;
  }, [v.start_date, v.start_time, v.end_date, v.end_time]);
  const total = days * (v.daily_price ?? 0) + (v.delivery ? (v.delivery_fee ?? 0) : 0);
  const balance = total - (v.advance_amount ?? 0);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const pickCar = (c: AvailableCar) => {
    form.setValue("car_later", false, { shouldDirty: true });
    form.setValue("vehicle_id", c.id, { shouldDirty: true });
    if (!priceTouched.current) form.setValue("daily_price", c.daily_rate);
    if (!reservationId) form.setValue("km_out", c.current_km);
  };

  const validate = (upTo: number): boolean => {
    const parsed = reservationSchema.safeParse(form.getValues());
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const all = zodFieldErrors(parsed.error.issues);
    const relevant = Object.fromEntries(
      Object.entries(all).filter(([k]) => STEP_FIELDS.slice(0, upTo + 1).flat().includes(k.split(".")[0])),
    );
    setErrors(relevant);
    if (Object.keys(relevant).length) {
      const first = steps.findIndex((_, i) => Object.keys(relevant).some((k) => STEP_FIELDS[i].includes(k.split(".")[0])));
      if (first >= 0 && first !== step) setStep(first);
      return false;
    }
    return true;
  };

  const next = async () => {
    if (step === 0) {
      if (!validate(0)) return;
      const cn = (form.getValues("contract_number") ?? "").trim();
      if (cn) {
        const taken = await contractNumberTakenAction(cn, reservationId);
        if (taken.ok && taken.data) {
          setErrors({ contract_number: "contractNumberTaken" });
          return;
        }
      }
    } else if (!validate(step)) return;
    if (step < 3) setStep(step + 1);
    else save();
  };

  const save = () => {
    if (!validate(3)) return;
    startTransition(async () => {
      const result = await saveReservationAction(form.getValues(), reservationId);
      if (!result.ok) {
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
          const first = steps.findIndex((_, i) => Object.keys(result.fieldErrors!).some((k) => STEP_FIELDS[i].includes(k.split(".")[0])));
          if (first >= 0) setStep(first);
        }
        toast.error(te(result.error));
        return;
      }
      if (!reservationId) clearDraft();
      toast.success(reservationId ? t("updated") : t("created"));
      router.push(`/reservations/${result.data.id}`);
    });
  };

  const err = (k: string) => errors[k];

  const summary = (
    <dl className="flex flex-col gap-2 text-sm" data-testid="wizard-summary">
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{t("summary.car")}</dt>
        <dd className="text-end font-medium">{car ? <>{car.brand_model} · <Ltr>{car.plate}</Ltr></> : v.car_later ? t("carLaterShort") : "—"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{t("summary.dates")}</dt>
        <dd className="text-end">
          {v.start_date && v.end_date ? (
            <>
              <Ltr>{`${formatDate(v.start_date)} ${v.start_time}`}</Ltr>
              <br /><Arrow /><Ltr>{`${formatDate(v.end_date)} ${v.end_time}`}</Ltr>
            </>
          ) : "—"}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{t("summary.client")}</dt>
        <dd className="text-end font-medium">{v.driver1?.full_name || "—"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{t("summary.days", { count: days })}</dt>
        <dd><Ltr>{formatMoney(days * (v.daily_price ?? 0))}</Ltr></dd>
      </div>
      {v.delivery ? (
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("summary.delivery")}</dt>
          <dd><Ltr>{formatMoney(v.delivery_fee ?? 0)}</Ltr></dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-3 border-t pt-2 text-base font-bold">
        <dt>{t("summary.total")}</dt>
        <dd data-testid="summary-total"><Ltr>{formatMoney(total)}</Ltr></dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{t("summary.advance")}</dt>
        <dd><Ltr>{formatMoney(v.advance_amount ?? 0)}</Ltr></dd>
      </div>
      <div className="flex justify-between gap-3 font-semibold">
        <dt>{t("summary.balance")}</dt>
        <dd data-testid="summary-balance"><Ltr>{formatMoney(balance)}</Ltr></dd>
      </div>
    </dl>
  );

  return (
    <div className="grid gap-4 pb-40 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        {draft && !draftDecided && !touched ? (
          <Alert variant="info" className="flex-wrap items-center" data-testid="draft-banner">
            <FileClockIcon aria-hidden />
            <span className="flex-1">{t("draftFound", { date: new Date(draft.savedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) })}</span>
            <span className="flex gap-2">
              <Button size="sm" onClick={resumeDraft}>
                <RotateCcwIcon aria-hidden />
                {t("draftResume")}
              </Button>
              <Button size="sm" variant="ghost" onClick={discardDraft}>
                <Trash2Icon aria-hidden />
                {t("draftDiscard")}
              </Button>
            </span>
          </Alert>
        ) : null}
        <Field
          id="contract_number"
          label={t("contractNumber")}
          hint={t("contractNumberHint", { next: contractPlaceholder })}
          error={err("contract_number")}
          className="max-w-sm"
        >
          <Input
            id="contract_number"
            dir="ltr"
            placeholder={contractPlaceholder}
            className="text-lg font-semibold"
            aria-invalid={err("contract_number") ? true : undefined}
            {...form.register("contract_number")}
          />
        </Field>

        <Stepper steps={steps} current={step} counterLabel={t("stepOf", { current: step + 1, total: 4 })} onStepClick={setStep} />

        <Card>
          <CardHeader>
            <CardTitle>
              <span ref={headingRef} tabIndex={-1} className="outline-none">
                {steps[step]}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {step === 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(["start_date", "start_time", "end_date", "end_time"] as const).map((k) => (
                    <Field key={k} id={k} label={t(k)} error={err(k)}>
                      <Controller
                        control={form.control}
                        name={k}
                        render={({ field }) =>
                          k.endsWith("date") ? (
                            <DateField id={k} value={field.value} onChange={field.onChange} aria-invalid={err(k) ? true : undefined} />
                          ) : (
                            <TimeField id={k} value={field.value} onChange={field.onChange} />
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("carWhen")}</span>
                  <ChoiceChips
                    name="car_when"
                    label={t("carWhen")}
                    value={v.car_later ? "later" : "now"}
                    onChange={(x) => {
                      form.setValue("car_later", x === "later", { shouldDirty: true });
                      if (x === "later") form.setValue("vehicle_id", "", { shouldDirty: true });
                    }}
                    options={[
                      { value: "now", label: t("carNow"), description: t("carNowHint"), icon: <CarIcon className="size-4" aria-hidden /> },
                      { value: "later", label: t("carLater"), description: t("carLaterHint"), icon: <CalendarClockIcon className="size-4" aria-hidden /> },
                    ]}
                  />
                </div>
                {v.car_later ? (
                  <Alert variant="info" data-testid="car-later-note">
                    <CalendarClockIcon aria-hidden />
                    {t("carLaterNote")}
                  </Alert>
                ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("chooseCar")}</span>
                  {loadingCars && !cars ? <p className="text-muted-foreground">{t("loadingCars")}</p> : null}
                  {cars && cars.length === 0 ? <Alert variant="warning">{t("noCarFree")}</Alert> : null}
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="available-cars">
                    {(cars ?? []).map((c) => {
                      const selected = v.vehicle_id === c.id;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => pickCar(c)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl border-2 bg-card p-3 text-start transition-colors hover:bg-accent",
                              selected ? "border-primary bg-primary/5 dark:border-ring" : "border-border",
                            )}
                          >
                            <CarIcon className="mt-0.5 size-6 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="font-semibold">{c.brand_model}</span>
                              <Ltr className="text-sm text-muted-foreground">{c.plate}</Ltr>
                              <span className="text-xs text-muted-foreground">
                                {tf(`categories.${c.category}`)} · {tf(`gearboxes.${c.gearbox}`)}
                              </span>
                            </span>
                            <span className="shrink-0 text-end font-bold">
                              <Ltr>{formatMoney(c.daily_rate)}</Ltr>
                              <span className="block text-xs font-normal text-muted-foreground">{t("perDay")}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {err("vehicle_id") ? <p role="alert" className="text-sm font-medium text-destructive">{t("carRequired")}</p> : null}
                  {unavailable.booked + unavailable.maintenance + unavailable.insurance > 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="unavailable-note">
                      {t("unavailable", {
                        count: unavailable.booked + unavailable.maintenance + unavailable.insurance,
                        booked: unavailable.booked,
                        maintenance: unavailable.maintenance,
                        insurance: unavailable.insurance,
                      })}
                    </p>
                  ) : null}
                </div>
                )}
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h3 className="text-base font-semibold">{t("driver1")}</h3>
                <DriverFields form={form} prefix="driver1" minAge={settings.minDriverAge} minLicenseYears={settings.minLicenseYears} errors={errors} />
                <div className="flex flex-col gap-2 border-t pt-4">
                  <span className="font-semibold">{t("addDriver2")}</span>
                  <Controller
                    control={form.control}
                    name="has_driver2"
                    render={({ field }) => (
                      <YesNo
                        label={t("addDriver2")}
                        value={field.value}
                        onChange={(yes) => {
                          field.onChange(yes);
                          if (yes && !form.getValues("driver2")) form.setValue("driver2", { ...EMPTY_DRIVER });
                        }}
                      />
                    )}
                  />
                </div>
                {v.has_driver2 ? (
                  <>
                    <h3 className="text-base font-semibold">{t("driver2")}</h3>
                    <DriverFields form={form} prefix="driver2" minAge={settings.minDriverAge} minLicenseYears={settings.minLicenseYears} errors={errors} />
                  </>
                ) : null}
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="daily_price" label={t("dailyPrice")} hint={car ? t("carRate", { price: formatMoney(car.daily_rate) }) : undefined} error={err("daily_price")}>
                    <Controller
                      control={form.control}
                      name="daily_price"
                      render={({ field }) => (
                        <MoneyField
                          id="daily_price"
                          value={field.value ?? null}
                          onChange={(n) => {
                            priceTouched.current = true;
                            field.onChange(n ?? 0);
                          }}
                        />
                      )}
                    />
                  </Field>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{t("days")}</span>
                    <span className="flex h-11 items-center rounded-lg bg-muted px-3 text-lg font-semibold">{t("daysValue", { count: days })}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-semibold">{t("delivery")}</span>
                  <Controller control={form.control} name="delivery" render={({ field }) => <YesNo label={t("delivery")} value={field.value} onChange={field.onChange} />} />
                </div>
                {v.delivery ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field id="delivery_place" label={t("deliveryPlace")} error={err("delivery_place")}>
                      <Input id="delivery_place" aria-invalid={err("delivery_place") ? true : undefined} {...form.register("delivery_place")} />
                    </Field>
                    <Field id="return_place" label={t("returnPlace")}>
                      <Input id="return_place" {...form.register("return_place")} />
                    </Field>
                    <Field id="delivery_fee" label={t("deliveryFee")}>
                      <Controller control={form.control} name="delivery_fee" render={({ field }) => <MoneyField id="delivery_fee" value={field.value ?? null} onChange={(n) => field.onChange(n ?? 0)} />} />
                    </Field>
                  </div>
                ) : null}

                <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <Field id="advance_amount" label={t("advance")}>
                    <Controller control={form.control} name="advance_amount" render={({ field }) => <MoneyField id="advance_amount" value={field.value ?? null} onChange={(n) => field.onChange(n ?? 0)} />} />
                  </Field>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{t("advanceMethod")}</span>
                    <Controller
                      control={form.control}
                      name="advance_method"
                      render={({ field }) => (
                        <ChoiceChips name="advance_method" label={t("advanceMethod")} value={field.value} onChange={field.onChange} className="grid-cols-2" options={PAYMENT_METHODS.map((m) => ({ value: m, label: tp(m) }))} />
                      )}
                    />
                  </div>
                  <Field id="franchise" label={t("franchise")} hint={t("franchiseHint")}>
                    <Controller control={form.control} name="franchise" render={({ field }) => <MoneyField id="franchise" value={field.value ?? null} onChange={(n) => field.onChange(n ?? 0)} />} />
                  </Field>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <span className="font-semibold">{t("deposit")}</span>
                  <Controller control={form.control} name="deposit_taken" render={({ field }) => <YesNo label={t("deposit")} value={field.value} onChange={field.onChange} />} />
                </div>
                {v.deposit_taken ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="deposit_amount" label={t("depositAmount")}>
                      <Controller control={form.control} name="deposit_amount" render={({ field }) => <MoneyField id="deposit_amount" value={field.value ?? null} onChange={(n) => field.onChange(n ?? 0)} />} />
                    </Field>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("depositMethod")}</span>
                      <Controller
                        control={form.control}
                        name="deposit_method"
                        render={({ field }) => (
                          <ChoiceChips name="deposit_method" label={t("depositMethod")} value={field.value} onChange={field.onChange} className="grid-cols-2" options={PAYMENT_METHODS.map((m) => ({ value: m, label: tp(m) }))} />
                        )}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === 3 ? (
              <>
                {v.car_later ? (
                  <Alert variant="info">
                    <CalendarClockIcon aria-hidden />
                    {t("checkoutLater")}
                  </Alert>
                ) : (
                <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="km_out" label={t("kmOut")} hint={car ? t("kmOutHint", { km: car.current_km.toLocaleString("fr-FR").replace(/ /g, " ") }) : undefined}>
                    <Controller
                      control={form.control}
                      name="km_out"
                      render={({ field }) => (
                        <Input
                          id="km_out"
                          inputMode="numeric"
                          dir="ltr"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")))}
                        />
                      )}
                    />
                  </Field>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <FuelIcon className="size-4" aria-hidden />
                    {t("fuelOut")}
                  </span>
                  <Controller control={form.control} name="fuel_out" render={({ field }) => <FuelPicker value={field.value} onChange={field.onChange} label={t("fuelOut")} />} />
                </div>
                </>
                )}
                {settings.equipmentItems.length ? (
                  <div className="border-t pt-2">
                    <h3 className="pt-2 font-semibold">{t("equipment")}</h3>
                    <Controller
                      control={form.control}
                      name="equipment"
                      render={({ field }) => (
                        <div>
                          {settings.equipmentItems.map((item) => (
                            <YesNoRow
                              key={item}
                              label={item}
                              value={field.value.includes(item)}
                              onChange={(yes) => field.onChange(yes ? [...new Set([...field.value, item])] : field.value.filter((x) => x !== item))}
                            />
                          ))}
                        </div>
                      )}
                    />
                  </div>
                ) : null}
                {settings.documentItems.length ? (
                  <div className="border-t pt-2">
                    <h3 className="pt-2 font-semibold">{t("documents")}</h3>
                    <Controller
                      control={form.control}
                      name="documents_given"
                      render={({ field }) => (
                        <div>
                          {settings.documentItems.map((item) => (
                            <YesNoRow
                              key={item}
                              label={item}
                              value={field.value.includes(item)}
                              onChange={(yes) => field.onChange(yes ? [...new Set([...field.value, item])] : field.value.filter((x) => x !== item))}
                            />
                          ))}
                        </div>
                      )}
                    />
                  </div>
                ) : null}
                <Field id="notes" label={t("notes")}>
                  <Textarea id="notes" rows={3} {...form.register("notes")} />
                </Field>
              </>
            ) : null}

            {Object.keys(errors).length ? (
              <Alert variant="danger">
                <TriangleAlertIcon aria-hidden />
                <span>{te("invalidForm")}</span>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Summary: side panel on laptops, bottom sheet on phones */}
      <aside className="hidden lg:block">
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle>{t("summary.title")}</CardTitle>
          </CardHeader>
          <CardContent>{summary}</CardContent>
        </Card>
      </aside>
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent closeLabel={tc("close")} className="lg:hidden">
          <DialogTitle>{t("summary.title")}</DialogTitle>
          {summary}
        </DialogContent>
      </Dialog>

      <StickyActionBar innerClassName="flex-col sm:flex-row sm:items-center lg:justify-end">
        <button
          type="button"
          onClick={() => setSummaryOpen(true)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-muted px-3 text-sm font-medium lg:hidden"
        >
          <span className="flex items-center gap-2">
            <ReceiptTextIcon className="size-4" aria-hidden />
            {t("summary.title")}
          </span>
          <span className="font-bold">
            <Ltr>{formatMoney(total)}</Ltr>
          </span>
        </button>
        <div className="flex w-full gap-2 sm:justify-end">
          {step > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={pending}>
              <ArrowLeftIcon className="rtl:rotate-180" aria-hidden />
              {t("back")}
            </Button>
          ) : null}
          <Button type="button" size="lg" className="flex-1 sm:flex-none" onClick={next} disabled={pending}>
            {step === 3 ? <CheckIcon aria-hidden /> : null}
            {step === 3 ? (reservationId ? t("saveChanges") : t("save")) : t("next")}
            {step < 3 ? <ArrowRightIcon className="rtl:rotate-180" aria-hidden /> : null}
          </Button>
        </div>
      </StickyActionBar>
    </div>
  );
}

/** Fuel level: four big buttons ¼ ½ ¾ plein. */
export function FuelPicker({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((q) => (
        <button
          key={q}
          type="button"
          role="radio"
          aria-checked={value === q}
          onClick={() => onChange(q)}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 font-bold",
            value === q ? "border-primary bg-primary/5 dark:border-ring" : "border-border bg-card hover:bg-accent",
          )}
        >
          <span dir="ltr">{q}/4</span>
          <span className="flex h-1.5 w-10 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="bg-primary dark:bg-ring" style={{ width: `${q * 25}%` }} />
          </span>
        </button>
      ))}
    </div>
  );
}
