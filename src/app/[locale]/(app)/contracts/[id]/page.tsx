import { ArrowLeftIcon, CalendarCheckIcon, CircleAlertIcon, CircleCheckIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AgencyLogo } from "@/components/app/agency-logo";
import { Arrow, Ltr } from "@/components/app/ltr";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { getContractData, missingInfo, type ContractDriver } from "@/lib/contracts/data";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { ReservationStatusBadge } from "../../reservations/components/status-badge";
import { ContractShare } from "../components/contract-share";
import { SignButton } from "../components/sign-button";
import { PoweredBy } from "@/components/app/powered-by";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("contracts") };
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border p-3 ${className ?? ""}`}>
      <h2 className="mb-2 text-sm font-bold text-primary dark:text-foreground">{title}</h2>
      <dl className="grid gap-x-3 gap-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children ?? "—"}</dd>
    </div>
  );
}

/** The contract: the document only (sign, PDF, WhatsApp). The work is on the reservation page. */
export default async function ContractPage({ params }: PageProps<"/[locale]/contracts/[id]">) {
  const { id } = await params;
  const { agency: active } = await requireAgency();
  const t = await getTranslations("contracts");
  const tr = await getTranslations("reservations");
  const tp = await getTranslations("reservations.payment");
  const supabase = await createClient();
  const [data, { data: payments }] = await Promise.all([
    getContractData(supabase, active.id, id),
    supabase.from("reservation_payments").select("id, amount, method, kind, paid_at").eq("agency_id", active.id).eq("reservation_id", id).order("paid_at"),
  ]);
  if (!data) notFound();
  const { reservation: r, totals, agency } = data;
  const missing = missingInfo(data);
  const late = r.status === "on_rental" && new Date(r.end_at) < new Date();
  const fuel = (q: number | null) => (q === null ? "—" : `${q}/4`);
  const legal = [agency.rc && `RC ${agency.rc}`, agency.ice && `ICE ${agency.ice}`, agency.if_number && `IF ${agency.if_number}`, agency.patente && `Patente ${agency.patente}`, agency.cnss && `CNSS ${agency.cnss}`].filter(Boolean);

  const driver = (d: ContractDriver | null, title: string) =>
    d ? (
      <Section title={title}>
        <Item label={t("fields.name")}>{d.full_name}</Item>
        <Item label={t("fields.birth")}>{d.birth_date ? <><Ltr>{formatDate(d.birth_date)}</Ltr>{d.birth_place ? ` · ${d.birth_place}` : ""}</> : null}</Item>
        <Item label={t("fields.nationality")}>{d.nationality}</Item>
        <Item label={t("fields.address")}>{d.address}</Item>
        <Item label={t("fields.phone")}>{d.phone ? <a href={`tel:${d.phone}`} className="underline-offset-4 hover:underline"><Ltr>{formatPhone(d.phone)}</Ltr></a> : null}</Item>
        <Item label={d.id_type === "passport" ? t("fields.passport") : t("fields.cin")}>
          <Ltr>{d.id_number}</Ltr>
          {d.id_expires_on ? <span className="text-muted-foreground"> · {t("fields.until")} <Ltr>{formatDate(d.id_expires_on)}</Ltr></span> : null}
        </Item>
        <Item label={t("fields.license")}>{d.license_number ? <Ltr>{d.license_number}</Ltr> : null}</Item>
        <Item label={t("fields.licenseIssued")}>{d.license_issued_on ? <><Ltr>{formatDate(d.license_issued_on)}</Ltr>{d.license_issued_place ? ` · ${d.license_issued_place}` : ""}</> : null}</Item>
      </Section>
    ) : null;

  return (
    <>
      <Link href="/contracts" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
        {t("title")}
      </Link>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl" data-testid="contract-title">
            {t("contract")} <Ltr>{r.contract_number}</Ltr>
          </h1>
          <ReservationStatusBadge status={r.status} late={late} signed={Boolean(r.signed_at)} />
          {r.signed_at ? <span className="text-sm text-muted-foreground">{tr("detail.signedOn", { date: formatDateTime(r.signed_at) })}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status === "reserved" && !r.signed_at ? (
            <SignButton id={r.id} disabled={!r.vehicle} title={r.vehicle ? undefined : tr("actions.chooseCarFirst")} />
          ) : null}
          <Button variant="outline" size="lg" asChild>
            <Link href={`/reservations/${r.id}`} data-testid="open-reservation">
              <CalendarCheckIcon aria-hidden />
              {t("seeReservation")}
            </Link>
          </Button>
        </div>
        <ContractShare
          id={r.id}
          contractNumber={r.contract_number}
          clientName={r.driver1?.full_name ?? ""}
          clientPhone={r.driver1?.phone ?? null}
          agencyName={agency.name}
          car={`${r.vehicle?.brand_model ?? ""} ${r.vehicle?.plate ?? ""}`.trim()}
          start={formatDateTime(r.start_at)}
          end={formatDateTime(r.end_at)}
          balance={formatMoney(totals.balance)}
        />
      </div>

      {r.status === "reserved" || (r.status === "on_rental" && !r.signed_at) ? (
        missing.length ? (
          <Alert variant="warning" className="mb-4" data-testid="missing-info">
            <CircleAlertIcon aria-hidden />
            <div className="flex flex-col gap-1">
              <strong>{t("missing.title")}</strong>
              <ul className="flex flex-col gap-1">
                {missing.map((m) => (
                  <li key={m.key}>
                    {r.status === "reserved" ? (
                      <Link href={m.key === "car" ? `/reservations/${r.id}?do=car` : `/reservations/${r.id}/edit?step=${m.step}`} className="font-medium underline underline-offset-4">
                        {t(`missing.${m.key}`)}
                      </Link>
                    ) : (
                      t(`missing.${m.key}`)
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Alert>
        ) : !r.signed_at ? (
          <Alert variant="success" className="mb-4" data-testid="ready-to-sign">
            <CircleCheckIcon aria-hidden />
            <span>{t("missing.ready")}</span>
          </Alert>
        ) : null
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* The paper contract */}
        <article className="rounded-xl border bg-card p-4 shadow-xs sm:p-6" aria-label={`${t("contract")} ${r.contract_number}`} data-testid="paper-contract">
          <header className="mb-4 flex items-start gap-3 border-b-2 border-primary pb-3 dark:border-ring">
            <AgencyLogo name={agency.name} url={agency.logoUrl} size={52} />
            <div className="min-w-0">
              <p className="text-lg font-bold">{agency.name}</p>
              <p className="text-sm text-muted-foreground">{[agency.address, agency.city].filter(Boolean).join(", ")}</p>
              <p className="text-sm text-muted-foreground"><Ltr>{formatPhone(agency.phone)}</Ltr>{agency.email ? ` · ${agency.email}` : ""}</p>
              {legal.length ? <p className="text-xs text-muted-foreground">{legal.join(" · ")}</p> : <p className="text-xs text-warning">{t("noLegal")}</p>}
            </div>
          </header>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-bold text-primary dark:text-foreground">{t("paperTitle")}</p>
            <p className="rounded-md border-2 border-primary px-3 py-1 font-bold dark:border-ring">N° <Ltr>{r.contract_number}</Ltr></p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Section title={t("sections.rental")}>
              <Item label={t("fields.departure")}><Ltr>{formatDateTime(r.start_at)}</Ltr></Item>
              <Item label={t("fields.plannedReturn")}><Ltr>{formatDateTime(r.end_at)}</Ltr>{r.extended_days ? <Badge variant="info" className="ms-1">+{r.extended_days} j</Badge> : null}</Item>
              {r.actual_return_at ? <Item label={t("fields.actualReturn")}><Ltr>{formatDateTime(r.actual_return_at)}</Ltr></Item> : null}
              <Item label={t("fields.delivery")}>{r.delivery ? <>{r.delivery_place}{r.return_place ? <><Arrow />{r.return_place}</> : null}</> : t("no")}</Item>
            </Section>
            <Section title={t("sections.vehicle")}>
              <Item label={t("fields.model")}>{r.vehicle?.brand_model}</Item>
              <Item label={t("fields.plate")}><Ltr>{r.vehicle?.plate}</Ltr></Item>
              <Item label={t("fields.kmOut")}>{r.km_out !== null ? <Ltr>{r.km_out} km</Ltr> : null}{r.km_in !== null ? <><Arrow /><Ltr>{r.km_in} km</Ltr></> : null}</Item>
              <Item label={t("fields.fuel")}><Ltr>{fuel(r.fuel_out)}</Ltr>{r.fuel_in !== null ? <><Arrow /><Ltr>{fuel(r.fuel_in)}</Ltr></> : null}</Item>
            </Section>
            {driver(r.driver1, t("sections.driver1"))}
            {driver(r.driver2, t("sections.driver2"))}
            <Section title={t("sections.price")}>
              <Item label={t("fields.days")}><Ltr>{totals.days} × {formatMoney(r.daily_price)}</Ltr></Item>
              {r.delivery ? <Item label={t("fields.deliveryFee")}><Ltr>{formatMoney(r.delivery_fee)}</Ltr></Item> : null}
              {Number(r.damage_fee) > 0 ? <Item label={t("fields.damageFee")}><Ltr>{formatMoney(r.damage_fee)}</Ltr>{r.damage_note ? <span className="block text-xs font-normal text-muted-foreground">{r.damage_note}</span> : null}</Item> : null}
              <Item label={t("fields.total")}><span className="text-base font-bold"><Ltr>{formatMoney(totals.total)}</Ltr></span></Item>
              <Item label={t("fields.paid")}><Ltr>{formatMoney(totals.paid)}</Ltr></Item>
              <Item label={t("fields.balance")}><span data-testid="contract-balance"><Ltr>{formatMoney(totals.balance)}</Ltr></span></Item>
              <Item label={t("fields.franchise")}><Ltr>{formatMoney(r.franchise)}</Ltr></Item>
              <Item label={t("fields.deposit")}>{r.deposit_taken ? <Ltr>{formatMoney(r.deposit_amount)}</Ltr> : t("no")}</Item>
            </Section>
            <Section title={t("sections.checklist")}>
              <Item label={t("fields.equipment")}>{r.equipment.length ? r.equipment.join(", ") : null}</Item>
              <Item label={t("fields.documents")}>{r.documents_given.length ? r.documents_given.join(", ") : null}</Item>
              {r.notes ? <Item label={t("fields.notes")}>{r.notes}</Item> : null}
            </Section>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-24 rounded-lg border border-dashed p-2 text-xs text-muted-foreground">{t("signClient")}</div>
            <div className="h-24 rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
              {t("signAgency")}
              {r.signed_at ? <p className="mt-1 font-medium text-foreground">{tr("detail.signedOn", { date: formatDateTime(r.signed_at) })}</p> : null}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <PoweredBy label={t("poweredBy")} />
          </p>
        </article>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="size-5 text-muted-foreground" aria-hidden />
              {t("payments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
