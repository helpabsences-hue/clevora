import { MessageCircleIcon, PhoneIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Arrow, Ltr } from "@/components/app/ltr";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { casablancaToIso, formatDateTime } from "@/lib/format";
import { whatsappNumber } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

type Driver = { full_name: string; phone: string | null; address: string | null; id_type: string; id_number: string } | null;

/** Who had the car at that moment (or during that day): driver(s) with contact and ID. */
export async function InfractionResults({ agencyId, plate, date, time }: { agencyId: string; plate: string; date: string; time: string }) {
  const t = await getTranslations("reservations.infraction");
  const supabase = await createClient();
  const from = casablancaToIso(date, time || "00:00");
  const to = time ? from : casablancaToIso(date, "23:59");
  const { data: ids } = await supabase.rpc("who_had_car", { p_agency: agencyId, p_plate: plate, p_from: from, p_to: to });
  const list = (ids ?? []) as unknown as string[];
  if (!list.length) return <Alert variant="info">{t("none")}</Alert>;

  const { data } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, start_at, end_at, actual_return_at, vehicle:vehicles!reservations_agency_id_vehicle_id_fkey(plate, brand_model), client:clients!reservations_agency_id_client_id_fkey(full_name, phone, address, id_type, id_number), driver2:clients!reservations_agency_id_second_driver_id_fkey(full_name, phone, address, id_type, id_number)",
    )
    .in("id", list);

  const driver = (d: Driver, label: string) =>
    d ? (
      <div className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-semibold">{d.full_name}</span>
        <span className="text-sm">
          {d.id_type === "passport" ? t("passport") : t("cin")} <Ltr>{d.id_number}</Ltr>
        </span>
        {d.address ? <span className="text-sm text-muted-foreground">{d.address}</span> : null}
        {d.phone ? (
          <div className="mt-1 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${d.phone}`}>
                <PhoneIcon aria-hidden />
                <Ltr>{d.phone}</Ltr>
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`https://wa.me/${whatsappNumber(d.phone)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircleIcon aria-hidden />
                WhatsApp
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <ul className="flex flex-col gap-3" data-testid="infraction-results">
      {(data ?? []).map((r) => (
        <li key={r.id} className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/contracts/${r.id}`} className="font-bold hover:underline">
              {t("contract")} <Ltr>{r.contract_number}</Ltr>
            </Link>
            <span className="text-sm text-muted-foreground">
              {r.vehicle?.brand_model} · <Ltr>{r.vehicle?.plate}</Ltr> · <Ltr>{formatDateTime(r.start_at)}</Ltr><Arrow /><Ltr>{formatDateTime(r.actual_return_at ?? r.end_at)}</Ltr>
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {driver(r.client as Driver, t("driver1"))}
            {driver(r.driver2 as Driver, t("driver2"))}
          </div>
        </li>
      ))}
    </ul>
  );
}
