import { ArrowLeftIcon, CarIcon, CircleAlertIcon, ClipboardCheckIcon, FileTextIcon, MessageCircleIcon, PhoneIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Arrow, Ltr } from "@/components/app/ltr";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { getContractData, missingInfo } from "@/lib/contracts/data";
import { formatDate, formatDateTime, formatMoney, isoToCasablanca } from "@/lib/format";
import { formatPhone, whatsappNumber } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { newDamages, type Damage } from "@/lib/inspections/model";
import { ReservationActions } from "../components/reservation-actions";
import { ReservationStatusBadge } from "../components/status-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("reservations") };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-end font-medium">{children ?? "—"}</dd>
    </div>
  );
}

/**
 * The reservation: the daily work happens here (choose the car, start, return,
 * extend, payment, cancel). The contract page is only the document.
 */
export default async function ReservationPage({ params, searchParams }: PageProps<"/[locale]/reservations/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const { agency: active } = await requireAgency();
  const t = await getTranslations("reservations.detail");
  const tc = await getTranslations("contracts");
  const tp = await getTranslations("reservations.payment");
  const supabase = await createClient();
  const [data, { data: payments }, { data: plannedRow }, { data: inspected }] = await Promise.all([
    getContractData(supabase, active.id, id),
    supabase.from("reservation_payments").select("id, amount, method, kind, paid_at").eq("agency_id", active.id).eq("reservation_id", id).order("paid_at"),
    supabase.from("reservation_totals").select("planned_days").eq("id", id).maybeSingle(),
    active.inspection.enabled
      ? supabase.from("inspections").select("kind, completed_at, damages:inspection_damages(id, x, y, type, view, note, source, confirmed)").eq("agency_id", active.id).eq("reservation_id", id)
      : Promise.resolve({ data: null }),
  ]);
  // Inspection turned on: remind it in Démarrer / Retour (never blocks).
  const ti = await getTranslations("inspection");
  const marks = (kind: string): Damage[] =>
    (inspected?.find((i) => i.kind === kind)?.damages ?? []).map((d) => ({ id: d.id, x: Number(d.x), y: Number(d.y), type: d.type as Damage["type"], view: d.view as Damage["view"], note: d.note, source: d.source as Damage["source"], confirmed: d.confirmed }));
  const found = inspected ? newDamages(marks("departure"), marks("return")) : [];
  const damages = found.length ? { count: found.length, text: found.map((d) => ti(`types.${d.type}`) + (d.view ? ` (${ti(`views.${d.view}`)})` : "")).join(", ") } : null;
  const inspectionDone = inspected ? { departure: inspected.some((i) => i.kind === "departure" && i.completed_at), return: inspected.some((i) => i.kind === "return" && i.completed_at) } : null;
  if (!data) notFound();
  const { reservation: r, totals } = data;
  const missing = missingInfo(data);
  const late = r.status === "on_rental" && new Date(r.end_at) < new Date();
  const fuel = (q: number | null) => (q === null ? "—" : `${q}/4`);
  const phone = r.driver1?.phone ?? null;

  return (
    <>
      <Link href="/reservations" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
        {t("back")}
      </Link>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl" data-testid="reservation-title">
            {r.driver1?.full_name ?? t("title")}
          </h1>
          <ReservationStatusBadge status={r.status} late={late} signed={Boolean(r.signed_at)} />
        </div>
        <p className="text-muted-foreground">
          {t("number")} <Ltr>{r.contract_number}</Ltr>
          {r.vehicle ? (
            <>
              {" "}· {r.vehicle.brand_model} <Ltr>{r.vehicle.plate}</Ltr>
            </>
          ) : null}
        </p>
        <ReservationActions
          reservation={{
            id: r.id,
            status: r.status as "reserved" | "on_rental" | "returned" | "cancelled",
            signed: Boolean(r.signed_at),
            hasCar: Boolean(r.vehicle),
            car: r.vehicle ? `${r.vehicle.brand_model} ${r.vehicle.plate}` : "",
            start_at: r.start_at,
            end_at: r.end_at,
            daily_price: Number(r.daily_price),
            km_out: r.km_out,
            deposit_taken: r.deposit_taken,
            deposit_amount: Number(r.deposit_amount),
            franchise: Number(r.franchise),
            balance: totals.balance,
            planned_days: plannedRow?.planned_days ?? totals.days,
            local: { start: isoToCasablanca(r.start_at), end: isoToCasablanca(r.end_at), now: isoToCasablanca(new Date().toISOString()) },
          }}
          initialAction={typeof sp.do === "string" ? sp.do : null}
          inspection={inspectionDone}
          damages={damages}
        />
      </div>

      {r.status === "reserved" && missing.length ? (
        <Alert variant="warning" className="mb-4" data-testid="missing-info">
          <CircleAlertIcon aria-hidden />
          <div className="flex flex-col gap-1">
            <strong>{tc("missing.title")}</strong>
            <ul className="flex flex-col gap-1">
              {missing.map((m) => (
                <li key={m.key}>
                  <Link href={m.key === "car" ? `/reservations/${r.id}?do=car` : `/reservations/${r.id}/edit?step=${m.step}`} className="font-medium underline underline-offset-4">
                    {tc(`missing.${m.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("rental")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col divide-y text-sm">
              <Row label={tc("fields.departure")}><Ltr>{formatDateTime(r.start_at)}</Ltr></Row>
              <Row label={tc("fields.plannedReturn")}>
                <Ltr>{formatDateTime(r.end_at)}</Ltr>
                {r.extended_days ? <Badge variant="info" className="ms-1">+{r.extended_days} j</Badge> : null}
              </Row>
              {r.actual_return_at ? <Row label={tc("fields.actualReturn")}><Ltr>{formatDateTime(r.actual_return_at)}</Ltr></Row> : null}
              <Row label={tc("fields.delivery")}>{r.delivery ? <>{r.delivery_place}{r.return_place ? <><Arrow />{r.return_place}</> : null}</> : tc("no")}</Row>
              <Row label={tc("fields.model")}>{r.vehicle ? <>{r.vehicle.brand_model} · <Ltr>{r.vehicle.plate}</Ltr></> : null}</Row>
              <Row label={tc("fields.kmOut")}>{r.km_out !== null ? <Ltr>{r.km_out} km</Ltr> : null}{r.km_in !== null ? <><Arrow /><Ltr>{r.km_in} km</Ltr></> : null}</Row>
              <Row label={tc("fields.fuel")}><Ltr>{fuel(r.fuel_out)}</Ltr>{r.fuel_in !== null ? <><Arrow /><Ltr>{fuel(r.fuel_in)}</Ltr></> : null}</Row>
              <Row label={tc("fields.phone")}>{phone ? <Ltr>{formatPhone(phone)}</Ltr> : null}</Row>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {phone ? (
                <>
                  <Button variant="outline" asChild>
                    <a href={`tel:${phone}`}>
                      <PhoneIcon aria-hidden />
                      {t("call")}
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`https://wa.me/${whatsappNumber(phone)}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircleIcon aria-hidden />
                      WhatsApp
                    </a>
                  </Button>
                </>
              ) : null}
              <Button variant="outline" asChild>
                <Link href={`/contracts/${r.id}`} data-testid="open-contract">
                  <FileTextIcon aria-hidden />
                  {t("seeContract")}
                </Link>
              </Button>
              {active.inspection.enabled && r.status !== "cancelled" ? (
                <Button variant="outline" asChild>
                  <Link href={`/inspections/${r.id}`}>
                    <ClipboardCheckIcon aria-hidden />
                    {t("inspection")}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("price")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col divide-y text-sm">
              <Row label={tc("fields.days")}><Ltr>{totals.days} × {formatMoney(r.daily_price)}</Ltr></Row>
              {r.delivery ? <Row label={tc("fields.deliveryFee")}><Ltr>{formatMoney(r.delivery_fee)}</Ltr></Row> : null}
              {Number(r.damage_fee) > 0 ? (
                <Row label={t("damageFee")}>
                  <Ltr>{formatMoney(r.damage_fee)}</Ltr>
                  {r.damage_note ? <span className="block text-xs font-normal text-muted-foreground">{r.damage_note}</span> : null}
                </Row>
              ) : null}
              <Row label={tc("fields.total")}><span className="text-base font-bold"><Ltr>{formatMoney(totals.total)}</Ltr></span></Row>
              <Row label={tc("fields.paid")}><Ltr>{formatMoney(totals.paid)}</Ltr></Row>
              <Row label={tc("fields.balance")}>
                <span data-testid="reservation-balance" className={totals.balance > 0 && r.status !== "cancelled" ? "text-warning" : undefined}>
                  <Ltr>{formatMoney(totals.balance)}</Ltr>
                </span>
              </Row>
              <Row label={tc("fields.deposit")}>{r.deposit_taken ? <Ltr>{formatMoney(r.deposit_amount)}</Ltr> : tc("no")}</Row>
              <Row label={tc("fields.franchise")}><Ltr>{formatMoney(r.franchise)}</Ltr></Row>
            </dl>
            <h3 className="mt-4 mb-1 text-sm font-semibold">{tc("payments")}</h3>
            {payments?.length ? (
              <ul className="flex flex-col divide-y text-sm" data-testid="payments">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span>{tp(`kinds.${p.kind}`)} · {tp(p.method)} · <Ltr>{formatDate(p.paid_at)}</Ltr></span>
                    <Ltr className={p.kind === "deposit_refund" ? "text-muted-foreground" : "font-semibold"}>{p.kind === "deposit_refund" ? "−" : ""}{formatMoney(p.amount)}</Ltr>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{tc("noPayments")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
