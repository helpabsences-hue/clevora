import { CalendarPlusIcon, PencilIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { dayKey, formatDate, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { ReservationTable } from "../../reservations/components/reservation-table";
import { DeleteClient } from "../components/delete-client";
import { listClientReservations } from "../queries";
import { getClient } from "./client-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("clients") };
}

/** One client: details, "Nouvelle réservation" for them, and every rental. */
export default async function ClientPage({ params }: PageProps<"/[locale]/clients/[id]">) {
  const { id } = await params;
  const { agency } = await requireAgency();
  const t = await getTranslations("clients");
  const td = await getTranslations("reservations.driver");
  const supabase = await createClient();
  const [{ client: c }, rentals] = await Promise.all([getClient(supabase, agency.id, id), listClientReservations(supabase, agency.id, id)]);
  const owed = rentals.filter((r) => r.status !== "cancelled" && r.status !== "reserved").reduce((s, r) => s + Math.max(0, r.balance), 0);
  const today = dayKey(new Date());
  const lines: Array<[string, React.ReactNode]> = [
    [c.id_type === "cin" ? td("cinNumber") : td("passportNumber"), <Ltr key="n" className="font-semibold tracking-wide">{c.id_number}</Ltr>],
    [td("phone"), c.phone ? <a key="p" href={`tel:${c.phone}`} className="underline-offset-4 hover:underline"><Ltr>{formatPhone(c.phone)}</Ltr></a> : null],
    [t("form.email"), c.email ? <Ltr key="e">{c.email}</Ltr> : null],
    [td("nationality"), c.nationality],
    [td("address"), c.address],
    [td("birthDate"), c.birth_date ? <Ltr key="b">{formatDate(c.birth_date)}</Ltr> : null],
    [td("birthPlace"), c.birth_place],
    [td("idExpires"), c.id_expires_on ? <Ltr key="x" className={c.id_expires_on < today ? "font-semibold text-destructive" : ""}>{formatDate(c.id_expires_on)}</Ltr> : null],
    [td("licenseNumber"), c.license_number ? <Ltr key="l">{c.license_number}</Ltr> : null],
    [td("licenseDate"), c.license_issued_on ? <Ltr key="ld">{formatDate(c.license_issued_on)}</Ltr> : null],
    [td("licensePlace"), c.license_issued_place],
  ];

  return (
    <>
      <PageHeader
        title={c.full_name}
        subtitle={t("since", { date: formatDate(c.created_at), count: rentals.filter((r) => r.status !== "cancelled").length })}
        action={
          <div className="flex flex-wrap gap-2">
            {!c.anonymized_at ? (
              <Button size="lg" asChild>
                <Link href={`/reservations/new?client=${c.id}`}>
                  <CalendarPlusIcon aria-hidden />
                  {t("newReservation")}
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="lg" asChild>
              <Link href={`/clients/${c.id}/edit`}>
                <PencilIcon aria-hidden />
                {t("edit")}
              </Link>
            </Button>
            {agency.role === "admin" && rentals.length === 0 ? <DeleteClient id={c.id} name={c.full_name} /> : null}
          </div>
        }
      />
      {c.id_expires_on && c.id_expires_on < today ? (
        <Alert variant="warning" className="mb-4">
          <TriangleAlertIcon aria-hidden />
          {t("idExpired")}
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col divide-y text-sm">
              {lines.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 text-end break-words">{value || <span className="text-muted-foreground">—</span>}</dd>
                </div>
              ))}
            </dl>
            {c.notes ? <p className="mt-3 rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{c.notes}</p> : null}
            {owed > 0 ? (
              <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm font-semibold text-destructive" data-testid="client-owes">
                {t("owes")} <Ltr>{formatMoney(owed)}</Ltr>
              </p>
            ) : null}
          </CardContent>
        </Card>
        <section aria-labelledby="rentals-title">
          <h2 id="rentals-title" className="mb-3 text-xl font-bold">{t("rentals")}</h2>
          {rentals.length ? (
            <ReservationTable rows={rentals} now={new Date()} testId="client-rentals" />
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">{t("noRentals")}</p>
          )}
        </section>
      </div>
    </>
  );
}
