"use client";

import { BanIcon, CalendarPlusIcon, CarIcon, CheckIcon, ClipboardCheckIcon, CornerDownLeftIcon, PenLineIcon, PencilIcon, PlayIcon, PlusIcon, RepeatIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Ltr } from "@/components/app/ltr";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DateField, MoneyField, TimeField } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { YesNo } from "@/components/ui/yes-no";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { formatMoney } from "@/lib/format";
import { settleReturn } from "@/lib/damages";
import { rentalDays } from "@/lib/revenue";
import { cn } from "@/lib/utils";
import {
  addPaymentAction,
  assignVehicleAction,
  availabilityAction,
  type AvailableCar,
  cancelReservationAction,
  extendReservationAction,
  returnReservationAction,
  signReservationAction,
  startRentalAction,
} from "../actions";
import { PAYMENT_METHODS } from "../schema";
import { FuelPicker } from "./reservation-wizard";

type R = {
  id: string;
  status: "reserved" | "on_rental" | "returned" | "cancelled";
  signed: boolean;
  /** false: the car is chosen later (on this reservation, before the start). */
  hasCar: boolean;
  /** « Dacia Logan 12345-A-6 », for the start confirmation. */
  car: string;
  start_at: string;
  end_at: string;
  daily_price: number;
  km_out: number | null;
  deposit_taken: boolean;
  deposit_amount: number;
  /** Damages at return are never more than this. */
  franchise: number;
  balance: number;
  planned_days: number;
  /** Casablanca local date/time computed on the server (browsers can have outdated time-zone data). */
  local: { start: { date: string; time: string }; end: { date: string; time: string }; now: { date: string; time: string } };
};

/** "yyyy-mm-dd" + "HH:mm" as a naive instant: only differences between two of them are used. */
const naive = (date: string, time: string) => `${date}T${time || "00:00"}:00Z`;

type Dialogs = "start" | "return" | "extend" | "cancel" | "payment" | "car" | null;

/** Inspection turned on: which side is already documented (null: inspection is off). */
type InspectionDone = { departure: boolean; return: boolean } | null;

/** New damages found by the return inspection (confirmed marks), to prefill the damage fee. */
export type FoundDamages = { count: number; text: string } | null;

export function ReservationActions({
  reservation: r,
  initialAction,
  inspection = null,
  damages = null,
}: {
  reservation: R;
  initialAction: string | null;
  inspection?: InspectionDone;
  damages?: FoundDamages;
}) {
  const t = useTranslations("reservations.actions");
  const te = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const { writable } = useAgency();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<Dialogs>(
    initialAction === "return" && r.status === "on_rental"
      ? "return"
      : initialAction === "start" && r.status === "reserved" && r.hasCar
        ? "start"
        : initialAction === "car" && r.status === "reserved"
        ? "car"
        : initialAction === "payment" && r.status !== "cancelled"
          ? "payment"
          : null,
  );

  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        // Money rules checked by the database get their own clear message
        const field = result.fieldErrors?.damage_amount ?? result.fieldErrors?.refund_amount;
        return void toast.error(te(field === "damageOverFranchise" || field === "refundTooHigh" ? field : result.error));
      }
      toast.success(success);
      setOpen(null);
      router.replace(pathname);
    });

  const close = () => {
    setOpen(null);
    if (initialAction) router.replace(pathname);
  };

  return (
    <div className="flex flex-wrap gap-2" data-testid="reservation-actions">
      {r.status === "reserved" && !r.hasCar ? (
        <Button size="lg" disabled={!writable} onClick={() => setOpen("car")}>
          <CarIcon aria-hidden />
          {t("chooseCar")}
        </Button>
      ) : null}
      {r.status === "reserved" ? (
        <Button
          size="lg"
          disabled={!writable || pending || !r.hasCar}
          title={r.hasCar ? undefined : t("chooseCarFirst")}
          onClick={() => setOpen("start")}
          data-testid="start-rental"
        >
          <PlayIcon aria-hidden />
          {t("start")}
        </Button>
      ) : null}
      {r.status === "on_rental" ? (
        <Button size="lg" disabled={!writable} onClick={() => setOpen("return")}>
          <CornerDownLeftIcon aria-hidden />
          {t("return")}
        </Button>
      ) : null}
      {r.status === "reserved" || r.status === "on_rental" ? (
        <Button size="lg" variant="outline" disabled={!writable} onClick={() => setOpen("extend")}>
          <CalendarPlusIcon aria-hidden />
          {t("extend")}
        </Button>
      ) : null}
      {r.status === "reserved" && r.hasCar ? (
        <Button size="lg" variant="outline" disabled={!writable} onClick={() => setOpen("car")}>
          <RepeatIcon aria-hidden />
          {t("changeCar")}
        </Button>
      ) : null}
      {r.status === "reserved" ? (
        <Button size="lg" variant="outline" asChild disabled={!writable}>
          <Link href={`/reservations/${r.id}/edit`}>
            <PencilIcon aria-hidden />
            {t("edit")}
          </Link>
        </Button>
      ) : null}
      {r.status !== "cancelled" ? (
        <Button size="lg" variant="ghost" disabled={!writable} onClick={() => setOpen("payment")}>
          <PlusIcon aria-hidden />
          {t("payment")}
        </Button>
      ) : null}
      {r.status === "reserved" ? (
        <Button size="lg" variant="ghost" className="text-destructive" disabled={!writable} onClick={() => setOpen("cancel")}>
          <BanIcon aria-hidden />
          {t("cancel")}
        </Button>
      ) : null}

      {open === "start" ? (
        <StartDialog
          r={r}
          inspectionMissing={inspection !== null && !inspection.departure}
          pending={pending}
          onClose={close}
          onSubmit={() =>
            run(async () => {
              if (!r.signed) {
                const signed = await signReservationAction(r.id);
                if (!signed.ok) return signed;
              }
              return startRentalAction(r.id);
            }, t("started"))
          }
        />
      ) : null}
      {open === "return" ? <ReturnDialog r={r} damages={damages} inspectionMissing={inspection !== null && !inspection.return} pending={pending} onClose={close} onSubmit={(input) => run(() => returnReservationAction(r.id, input), t("returned"))} /> : null}
      {open === "extend" ? <ExtendDialog r={r} pending={pending} onClose={close} onSubmit={(d, tm) => run(() => extendReservationAction(r.id, d, tm), t("extended"))} /> : null}
      {open === "cancel" ? <CancelDialog pending={pending} onClose={close} onSubmit={(reason) => run(() => cancelReservationAction(r.id, reason), t("cancelled"))} /> : null}
      {open === "car" ? <AssignCarDialog r={r} pending={pending} onClose={close} onSubmit={(vehicleId, price) => run(() => assignVehicleAction(r.id, vehicleId, price), t("carAssigned"))} /> : null}
      {open === "payment" ? <PaymentDialog balance={r.balance} pending={pending} onClose={close} onSubmit={(p) => run(() => addPaymentAction(r.id, p), t("paymentAdded"))} /> : null}
    </div>
  );
}

function useDialogTexts() {
  return { t: useTranslations("reservations.actions"), tp: useTranslations("reservations.payment"), tc: useTranslations("common") };
}

/** « Démarrer » : one confirmation; an unsigned contract is signed at the same time. */
/** Not blocking: the inspection is a reminder with a link, the start / return still works. */
function InspectionReminder({ id, kind }: { id: string; kind: "departure" | "return" }) {
  const t = useTranslations("reservations.actions");
  return (
    <Alert variant="warning" className="flex flex-col gap-2" data-testid={`inspection-reminder-${kind}`}>
      {kind === "departure" ? t("inspectionDepartureMissing") : t("inspectionReturnMissing")}
      <Button variant="outline" asChild>
        <Link href={`/inspections/${id}/${kind}?then=${kind === "departure" ? "start" : "return"}`}>
          <ClipboardCheckIcon aria-hidden />
          {kind === "departure" ? t("doInspectionDeparture") : t("doInspectionReturn")}
        </Link>
      </Button>
    </Alert>
  );
}

function StartDialog({ r, inspectionMissing, pending, onClose, onSubmit }: { r: R; inspectionMissing: boolean; pending: boolean; onClose: () => void; onSubmit: () => void }) {
  const { t, tc } = useDialogTexts();
  const [signed, setSigned] = useState<boolean | null>(r.signed ? true : null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")} data-testid="start-dialog">
        <DialogHeader>
          <DialogTitle>{t("startTitle")}</DialogTitle>
          <DialogDescription>{r.car}</DialogDescription>
        </DialogHeader>
        {inspectionMissing ? <InspectionReminder id={r.id} kind="departure" /> : null}
        {!r.signed ? (
          <div className="flex flex-col gap-2">
            <span className="font-medium">{t("signedQuestion")}</span>
            <YesNo label={t("signedQuestion")} value={signed} onChange={setSigned} />
            {signed === false ? (
              <Alert variant="warning" className="flex flex-col gap-2">
                {t("signFirst")}
                <Button variant="outline" asChild>
                  <Link href={`/contracts/${r.id}`}>
                    <PenLineIcon aria-hidden />
                    {t("openContract")}
                  </Link>
                </Button>
              </Alert>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button size="lg" onClick={onSubmit} disabled={pending || signed !== true} data-testid="start-confirm">
            <PlayIcon aria-hidden />
            {t("start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({
  r,
  damages,
  inspectionMissing,
  pending,
  onClose,
  onSubmit,
}: {
  r: R;
  damages: FoundDamages;
  inspectionMissing: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: Parameters<typeof returnReservationAction>[1]) => void;
}) {
  const { t, tp, tc } = useDialogTexts();
  const [date, setDate] = useState(r.local.now.date);
  const [time, setTime] = useState(r.local.now.time);
  const [km, setKm] = useState<string>("");
  const [fuel, setFuel] = useState<number | null>(null);
  const start = naive(r.local.start.date, r.local.start.time);
  const actual = date && time ? naive(date, time) : naive(r.local.end.date, r.local.end.time);
  const extraDays = Math.max(0, rentalDays(start, actual) - r.planned_days);
  const extraAmount = extraDays * r.daily_price;
  const rentalDue = Math.max(0, r.balance + extraAmount);
  // Damages: kept from the caution, never more than the franchise (src/lib/damages.ts)
  const [hasDamage, setHasDamage] = useState<boolean>(Boolean(damages?.count) && r.franchise > 0);
  const [fee, setFee] = useState<number | null>(null);
  const [damageNote, setDamageNote] = useState(damages?.text ?? "");
  const deposit = r.deposit_taken ? r.deposit_amount : 0;
  const settle = settleReturn({ due: rentalDue, deposit, fee: hasDamage ? (fee ?? 0) : 0, franchise: r.franchise });
  const due = settle.toPay;
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("cash");
  const [refund, setRefund] = useState<boolean>(r.deposit_taken);
  // null: follows the damages (caution minus what is kept)
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [refundMethod, setRefundMethod] = useState<(typeof PAYMENT_METHODS)[number]>("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const kmNumber = km === "" ? null : Number(km);

  const submit = () => {
    if (kmNumber === null || fuel === null) return setError(t("returnMissing"));
    if (r.km_out !== null && kmNumber < r.km_out) return setError(t("kmInBeforeOut", { km: r.km_out }));
    if (hasDamage && !(fee && fee > 0)) return setError(t("damageAmountMissing"));
    if (hasDamage && (fee ?? 0) > r.franchise) return setError(t("damageOverFranchise", { amount: formatMoney(r.franchise) }));
    setError(null);
    onSubmit({
      return_date: date,
      return_time: time,
      km_in: kmNumber,
      fuel_in: fuel,
      balance_amount: amount ?? due,
      balance_method: method,
      refund_deposit: refund,
      refund_amount: refundAmount ?? settle.refund,
      refund_method: refundMethod,
      notes,
      damage_amount: hasDamage ? settle.fee : 0,
      damage_note: hasDamage ? damageNote : "",
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")} className="sm:max-w-2xl" data-testid="return-dialog">
        <DialogHeader>
          <DialogTitle>{t("returnTitle")}</DialogTitle>
          <DialogDescription>{t("returnSubtitle")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {inspectionMissing ? <InspectionReminder id={r.id} kind="return" /> : null}
          <div className="grid grid-cols-2 gap-3">
            <Field id="ret-date" label={t("returnDate")}>
              <DateField id="ret-date" value={date} onChange={setDate} />
            </Field>
            <Field id="ret-time" label={t("returnTime")}>
              <TimeField id="ret-time" value={time} onChange={setTime} />
            </Field>
          </div>
          <Field id="ret-km" label={t("kmIn")} hint={r.km_out !== null ? t("kmOutWas", { km: r.km_out }) : undefined}>
            <Input id="ret-km" inputMode="numeric" dir="ltr" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("fuelIn")}</span>
            <FuelPicker value={fuel} onChange={setFuel} label={t("fuelIn")} />
          </div>
          {extraDays > 0 ? (
            <Alert variant="warning" data-testid="extra-days">
              {t("extraDays", { count: extraDays, amount: formatMoney(extraAmount) })}
            </Alert>
          ) : null}
          {r.franchise > 0 ? (
            <div className="flex flex-col gap-3 border-t pt-4" data-testid="damage-section">
              <span className="font-semibold">{t("damageQuestion")}</span>
              {damages?.count ? (
                <Alert variant="warning" data-testid="damage-found">
                  {t("damageFound", { count: damages.count, list: damages.text })}
                </Alert>
              ) : null}
              <YesNo label={t("damageQuestion")} value={hasDamage} onChange={setHasDamage} />
              {hasDamage ? (
                <div className="flex flex-col gap-3">
                  <Field id="ret-damage" label={t("damageAmount")} hint={t("damageMax", { amount: formatMoney(r.franchise) })} className="sm:max-w-xs">
                    <MoneyField id="ret-damage" value={fee} onChange={setFee} />
                  </Field>
                  <Field id="ret-damage-note" label={t("damageNote")}>
                    <Input id="ret-damage-note" value={damageNote} maxLength={500} onChange={(e) => setDamageNote(e.target.value)} />
                  </Field>
                  {settle.fee > 0 ? (
                    <ul className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3 text-sm" data-testid="damage-settlement">
                      {deposit > 0 ? <li>{t("damageKept", { amount: formatMoney(settle.kept) })}</li> : null}
                      {deposit > 0 ? <li>{t("damageRefund", { amount: formatMoney(settle.refund) })}</li> : null}
                      {settle.fee > settle.kept ? <li className="font-semibold">{t("damageStillOwed", { amount: formatMoney(settle.fee - settle.kept) })}</li> : null}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Amount, then the 4 ways of paying on their own full-width row (they never overflow) */}
          <div className="flex flex-col gap-3 border-t pt-4">
            <Field id="ret-amount" label={t("balanceToPay")} hint={t("balanceDue", { amount: formatMoney(due) })} className="sm:max-w-xs">
              <MoneyField id="ret-amount" value={amount ?? due} onChange={setAmount} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("method")}</span>
              <ChoiceChips name="ret-method" label={t("method")} value={method} onChange={setMethod} className="grid-cols-2 sm:grid-cols-4" options={PAYMENT_METHODS.map((m) => ({ value: m, label: tp(m) }))} />
            </div>
          </div>
          {r.deposit_taken ? (
            <div className="flex flex-col gap-3 border-t pt-4">
              <span className="font-semibold">{t("refundDeposit", { amount: formatMoney(r.deposit_amount) })}</span>
              <YesNo label={t("refundDeposit", { amount: formatMoney(r.deposit_amount) })} value={refund} onChange={setRefund} />
              {refund ? (
                <div className="flex flex-col gap-3">
                  <Field id="ret-refund" label={t("refundAmount")} className="sm:max-w-xs">
                    <MoneyField id="ret-refund" value={refundAmount ?? settle.refund} onChange={setRefundAmount} />
                  </Field>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{t("method")}</span>
                    <ChoiceChips name="ret-refund-method" label={t("method")} value={refundMethod} onChange={setRefundMethod} className="grid-cols-2 sm:grid-cols-4" options={PAYMENT_METHODS.map((m) => ({ value: m, label: tp(m) }))} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <Field id="ret-notes" label={t("notes")}>
            <Textarea id="ret-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error ? <Alert variant="danger">{error}</Alert> : null}
        </div>
        <DialogFooter>
          <Button size="lg" onClick={submit} disabled={pending}>
            <CornerDownLeftIcon aria-hidden />
            {t("confirmReturn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtendDialog({ r, pending, onClose, onSubmit }: { r: R; pending: boolean; onClose: () => void; onSubmit: (date: string, time: string) => void }) {
  const { t, tc } = useDialogTexts();
  const [date, setDate] = useState(r.local.end.date);
  const [time, setTime] = useState(r.local.end.time);
  const start = naive(r.local.start.date, r.local.start.time);
  const oldEnd = naive(r.local.end.date, r.local.end.time);
  const newEnd = date && time ? naive(date, time) : oldEnd;
  const added = Math.max(0, rentalDays(start, newEnd) - rentalDays(start, oldEnd));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("extendTitle")}</DialogTitle>
          <DialogDescription>{t("extendSubtitle")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field id="ext-date" label={t("newEndDate")}>
            <DateField id="ext-date" value={date} onChange={setDate} min={r.local.end.date} />
          </Field>
          <Field id="ext-time" label={t("returnTime")}>
            <TimeField id="ext-time" value={time} onChange={setTime} />
          </Field>
        </div>
        {added > 0 ? (
          <p className="text-sm">
            {t("extendSummary", { count: added })} · <Ltr>{formatMoney(added * r.daily_price)}</Ltr>
          </p>
        ) : null}
        <DialogFooter>
          <Button size="lg" onClick={() => onSubmit(date, time)} disabled={pending || added === 0}>
            <CalendarPlusIcon aria-hidden />
            {t("confirmExtend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ pending, onClose, onSubmit }: { pending: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const { t, tc } = useDialogTexts();
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("cancelTitle")}</DialogTitle>
          <DialogDescription>{t("cancelSubtitle")}</DialogDescription>
        </DialogHeader>
        <Field id="cancel-reason" label={t("cancelReason")}>
          <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button size="lg" variant="destructive" onClick={() => onSubmit(reason)} disabled={pending || reason.trim().length < 3}>
            <BanIcon aria-hidden />
            {t("confirmCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  balance,
  pending,
  onClose,
  onSubmit,
}: {
  balance: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (p: Parameters<typeof addPaymentAction>[1]) => void;
}) {
  const { t, tp, tc } = useDialogTexts();
  const [amount, setAmount] = useState<number | null>(balance > 0 ? balance : null);
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("cash");
  const [kind, setKind] = useState<"advance" | "balance" | "extra" | "deposit" | "deposit_refund">("balance");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("paymentTitle")}</DialogTitle>
          <DialogDescription>{t("paymentSubtitle", { amount: formatMoney(balance) })}</DialogDescription>
        </DialogHeader>
        <Field id="pay-amount" label={t("amount")}>
          <MoneyField id="pay-amount" value={amount} onChange={setAmount} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("kind")}</span>
          <ChoiceChips name="pay-kind" label={t("kind")} value={kind} onChange={setKind} className="grid-cols-2" options={(["balance", "advance", "extra", "deposit", "deposit_refund"] as const).map((k) => ({ value: k, label: tp(`kinds.${k}`) }))} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("method")}</span>
          <ChoiceChips name="pay-method" label={t("method")} value={method} onChange={setMethod} className="grid-cols-2 sm:grid-cols-4" options={PAYMENT_METHODS.map((m) => ({ value: m, label: tp(m) }))} />
        </div>
        <DialogFooter>
          <Button size="lg" onClick={() => amount && onSubmit({ amount, method, kind, note: "" })} disabled={pending || !amount}>
            <PlusIcon aria-hidden />
            {t("savePayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/** Choisir la voiture: the cars free on the reservation's dates; keep the agreed price or use the car's. */
function AssignCarDialog({
  r,
  pending,
  onClose,
  onSubmit,
}: {
  r: R;
  pending: boolean;
  onClose: () => void;
  onSubmit: (vehicleId: string, newDailyPrice: number | null) => void;
}) {
  const { t, tc } = useDialogTexts();
  const tf = useTranslations("fleet");
  const te = useTranslations("errors");
  const [cars, setCars] = useState<AvailableCar[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [price, setPrice] = useState<"keep" | "car">("keep");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void availabilityAction(r.local.start, r.local.end, r.id).then((res) => {
      if (cancelled) return;
      if (res.ok) setCars(res.data.available);
      else setError(te(res.error));
    });
    return () => {
      cancelled = true;
    };
  }, [r.id, r.local.start, r.local.end, te]);

  const car = cars?.find((c) => c.id === chosen) ?? null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")} className="sm:max-w-2xl" data-testid="assign-car-dialog">
        <DialogHeader>
          <DialogTitle>{t("chooseCarTitle")}</DialogTitle>
          <DialogDescription>{t("chooseCarSubtitle")}</DialogDescription>
        </DialogHeader>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {!cars && !error ? <p className="text-muted-foreground">{t("loadingCars")}</p> : null}
        {cars && cars.length === 0 ? <Alert variant="warning">{t("noCarFree")}</Alert> : null}
        <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto sm:grid-cols-2" role="radiogroup" aria-label={t("chooseCarTitle")}>
          {(cars ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="radio"
                aria-checked={chosen === c.id}
                onClick={() => setChosen(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border-2 bg-card p-3 text-start transition-colors hover:bg-accent",
                  chosen === c.id ? "border-primary bg-primary/5 dark:border-ring" : "border-border",
                )}
              >
                <CarIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{c.brand_model}</span>
                  <Ltr className="text-sm text-muted-foreground">{c.plate}</Ltr>
                  <span className="text-xs text-muted-foreground">{tf(`categories.${c.category}`)} · {tf(`gearboxes.${c.gearbox}`)}</span>
                </span>
                <Ltr className="shrink-0 font-bold">{formatMoney(c.daily_rate)}</Ltr>
              </button>
            </li>
          ))}
        </ul>
        {car && car.daily_rate !== r.daily_price ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <span className="text-sm font-medium">{t("priceChoice")}</span>
            <ChoiceChips
              name="price-choice"
              label={t("priceChoice")}
              value={price}
              onChange={setPrice}
              options={[
                { value: "keep", label: t("keepPrice", { price: formatMoney(r.daily_price) }) },
                { value: "car", label: t("carPrice", { price: formatMoney(car.daily_rate) }) },
              ]}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button size="lg" disabled={!chosen || pending} onClick={() => chosen && onSubmit(chosen, price === "car" && car ? car.daily_rate : null)}>
            <CheckIcon aria-hidden />
            {t("confirmCar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
