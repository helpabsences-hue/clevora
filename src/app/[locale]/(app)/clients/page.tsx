import { PlusIcon, SearchXIcon, UsersRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAgency } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { listClients, type ClientRow } from "./queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("clients") };
}

/** Every client of the agency: search, open, add (with the ID scan). */
export default async function ClientsPage({ searchParams }: PageProps<"/[locale]/clients">) {
  const { agency } = await requireAgency();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const t = await getTranslations("clients");
  const td = await getTranslations("reservations.driver");
  const supabase = await createClient();
  const { rows, total, limited } = await listClients(supabase, agency.id, q);

  const columns: Column<ClientRow>[] = [
    {
      key: "name",
      header: t("columns.client"),
      priority: "primary",
      cell: (c) => (
        <span className="flex flex-col">
          <span className="flex flex-wrap items-center gap-2">
            {c.full_name}
            {c.anonymized_at ? <Badge variant="neutral">{t("anonymized")}</Badge> : null}
          </span>
          {c.phone ? <Ltr className="text-xs font-normal text-muted-foreground">{formatPhone(c.phone)}</Ltr> : null}
        </span>
      ),
    },
    {
      key: "id",
      header: t("columns.document"),
      priority: "high",
      cell: (c) => (
        <span className="flex flex-col">
          <Ltr className="font-semibold tracking-wide">{c.id_number}</Ltr>
          <span className="text-xs text-muted-foreground">{c.id_type === "cin" ? td("cin") : td("passport")}</span>
        </span>
      ),
    },
    { key: "license", header: t("columns.license"), priority: "low", cell: (c) => (c.license_number ? <Ltr>{c.license_number}</Ltr> : "—") },
    { key: "rentals", header: t("columns.rentals"), priority: "low", align: "end", cell: (c) => <Ltr>{c.rentals}</Ltr> },
    { key: "last", header: t("columns.last"), priority: "low", cell: (c) => (c.last_rental ? <Ltr>{formatDate(c.last_rental)}</Ltr> : <span className="text-muted-foreground">{t("never")}</span>) },
  ];

  const add = (
    <Button size="lg" asChild>
      <Link href="/clients/new">
        <PlusIcon aria-hidden />
        {t("add")}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { count: total })} action={add} />
      {total === 0 && !q ? (
        <EmptyState icon={UsersRoundIcon} title={t("empty")} description={t("emptyBody")} action={add} />
      ) : (
        <>
          <div className="mb-4 lg:max-w-md">
            <SearchBar placeholder={t("search")} />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={SearchXIcon} title={t("noResult")} description={t("noResultBody")} />
          ) : (
            <>
              {limited ? <p className="mb-2 text-sm text-muted-foreground">{t("limited", { count: rows.length })}</p> : null}
              <ResponsiveList rows={rows} columns={columns} rowKey={(c) => c.id} rowHref={(c) => `/clients/${c.id}`} caption={t("title")} testId="client-list" rowTestId="client-row" />
            </>
          )}
        </>
      )}
    </>
  );
}
