import { CalendarCheckIcon, CarIcon, InboxIcon, PlusIcon, TriangleAlertIcon, WalletIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { StatTile } from "@/components/app/stat-tile";
import { UrgencyGroups } from "@/components/app/urgency-groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatMoney } from "@/lib/format";
import { DevInteractive } from "./interactive";

type Row = { id: string; contract: string; client: string; phone: string; car: string; plate: string; endAt: string; balance: number; status: "late" | "on_rental" | "reserved" };

const H = 3_600_000;
const now = Date.now();
const ROWS: Row[] = [
  { id: "1", contract: "C-1042", client: "Karim Alaoui", phone: "+212 6 00 00 01 01", car: "Dacia Logan", plate: "12345-A-6", endAt: new Date(now - 20 * H).toISOString(), balance: 750, status: "late" },
  { id: "2", contract: "C-1043", client: "Fatima Zahra Berrada avec un nom très très long", phone: "+212 6 00 00 01 02", car: "Hyundai Tucson", plate: "22334-A-6", endAt: new Date(now + 3 * H).toISOString(), balance: 0, status: "on_rental" },
  { id: "3", contract: "P-0457", client: "Omar Chraibi", phone: "+212 6 00 00 01 03", car: "Peugeot 3008", plate: "33445-D-1", endAt: new Date(now + 26 * H).toISOString(), balance: 1250, status: "on_rental" },
  { id: "4", contract: "C-1044", client: "Nadia El Fassi", phone: "+212 6 00 00 01 04", car: "Mercedes Classe C", plate: "55667-H-6", endAt: new Date(now + 50 * H).toISOString(), balance: 3600, status: "reserved" },
  { id: "5", contract: "C-1045", client: "Julien Martin", phone: "+212 6 00 00 01 23", car: "Renault Kangoo", plate: "44556-A-6", endAt: new Date(now + 120 * H).toISOString(), balance: 400, status: "reserved" },
];

const STATUS = {
  late: <Badge variant="danger">En retard</Badge>,
  on_rental: <Badge variant="info">En location</Badge>,
  reserved: <Badge variant="neutral">Réservée</Badge>,
};

const COLUMNS: Column<Row>[] = [
  { key: "contract", header: "N° contrat", priority: "primary", cell: (r) => `${r.contract} · ${r.client}` },
  { key: "car", header: "Voiture", priority: "high", cell: (r) => <span>{r.car} <Ltr className="text-muted-foreground">{r.plate}</Ltr></span> },
  { key: "status", header: "Statut", priority: "high", hideLabelInCard: true, cell: (r) => STATUS[r.status] },
  { key: "end", header: "Retour", priority: "low", cell: (r) => <Ltr>{formatDateTime(r.endAt)}</Ltr> },
  { key: "phone", header: "Téléphone", priority: "low", cell: (r) => <Ltr>{r.phone}</Ltr> },
  { key: "balance", header: "Reste à payer", priority: "low", align: "end", cell: (r) => <Ltr>{formatMoney(r.balance)}</Ltr> },
];

/** Every shared component, for checking sizes, themes and RTL. Development only. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production" && process.env.PARCOLIA_DEV_UI !== "1") notFound();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Composants"
        subtitle="Page de développement — tailles, thèmes, RTL."
        action={
          <Button size="lg">
            <PlusIcon aria-hidden />
            Nouvelle réservation
          </Button>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">StatTile</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Disponibles" value={7} icon={CarIcon} tone="success" />
          <StatTile label="En location" value={4} icon={CalendarCheckIcon} tone="info" />
          <StatTile label="Retours en retard" value={1} icon={TriangleAlertIcon} tone="danger" href="/reservations" />
          <StatTile label="Chiffre d'affaires du mois" value={<Ltr>{formatMoney(48250)}</Ltr>} icon={WalletIcon} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Badge · Button</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Disponible</Badge>
          <Badge variant="warning">Bientôt</Badge>
          <Badge variant="danger">Expirée</Badge>
          <Badge variant="info">En location</Badge>
          <Badge variant="neutral">Vendue</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button><PlusIcon aria-hidden />Principal</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="outline">Contour</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="destructive">Supprimer</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">ResponsiveList</h2>
        <ResponsiveList rows={ROWS} columns={COLUMNS} rowKey={(r) => r.id} rowHref={() => "/dev/ui"} actions={() => <Button size="sm" variant="outline">Retour</Button>} caption="Réservations" testId="dev-list" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">UrgencyGroups</h2>
        <UrgencyGroups
          items={ROWS}
          getDate={(r) => r.endAt}
          render={(items) => (
            <ul className="flex flex-col gap-2">
              {items.map((r) => (
                <li key={r.id} className="rounded-lg border bg-card p-3 text-sm">
                  <span className="font-semibold">{r.client}</span> · {r.car} · <Ltr>{formatDateTime(r.endAt)}</Ltr>
                </li>
              ))}
            </ul>
          )}
        />
      </section>

      <DevInteractive />

      <section className="grid gap-3 md:grid-cols-2">
        <EmptyState icon={InboxIcon} title="Aucune réservation" description="Créez la première réservation : elle apparaîtra ici, triée par urgence." action={<Button><PlusIcon aria-hidden />Nouvelle réservation</Button>} />
        <Card>
          <CardHeader>
            <CardTitle>Skeleton</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-11 w-40" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
