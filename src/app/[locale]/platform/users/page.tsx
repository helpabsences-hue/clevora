import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { ResponsiveList, type Column } from "@/components/app/responsive-list";
import { SearchBar } from "@/components/app/search-bar";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { AddPlatformAdmin, RemovePlatformAdmin } from "../components/platform-admins";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.users");
  return { title: t("title") };
}

type Membership = { id: string; name: string; role: "admin" | "staff"; status: string };

/** Every account on Parcolia: agencies and roles, last login, two-step login. */
export default async function PlatformUsersPage({ searchParams }: PageProps<"/[locale]/platform/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const t = await getTranslations("platform.users");
  const tr = await getTranslations("roles");
  const me = await getUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_users");
  const all = (data ?? []).map((u) => ({ ...u, agencies: (u.agencies ?? []) as unknown as Membership[] }));
  type Row = (typeof all)[number];
  const LIMIT = 100;
  const matches = q ? all.filter((u) => u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q) || u.agencies.some((a) => a.name.toLowerCase().includes(q))) : all;
  // Long lists: the 100 most recent accounts; search finds everyone else.
  const rows = matches.slice(0, LIMIT);
  const admins = all.filter((u) => u.platform_admin);

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("name"),
      priority: "primary",
      cell: (u) => (
        <span className="flex flex-col">
          <span className="flex flex-wrap items-center gap-2">
            {u.full_name || "—"}
            {u.platform_admin ? <Badge variant="info">{t("parcoliaAdmin")}</Badge> : null}
          </span>
          <Ltr className="text-xs font-normal text-muted-foreground">{u.email}</Ltr>
        </span>
      ),
    },
    {
      key: "agencies",
      header: t("agencies"),
      priority: "high",
      cell: (u) =>
        u.agencies.length ? (
          <span className="flex flex-col gap-0.5 text-sm">
            {u.agencies.map((a) => (
              <span key={a.id}>
                <Link href={`/platform/agencies/${a.id}`} className="relative z-10 underline-offset-4 hover:underline">
                  {a.name}
                </Link>{" "}
                <span className="text-muted-foreground">· {tr(a.role)}{a.status !== "active" ? ` · ${a.status}` : ""}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "login",
      header: t("lastLogin"),
      priority: "low",
      cell: (u) => (u.last_sign_in_at ? <Ltr>{formatDate(u.last_sign_in_at)}</Ltr> : <span className="text-muted-foreground">{t("never")}</span>),
    },
    { key: "created", header: t("created"), priority: "low", cell: (u) => <Ltr>{formatDate(u.created_at)}</Ltr> },
    {
      key: "security",
      header: t("security"),
      priority: "low",
      cell: (u) => (
        <span className="flex flex-col gap-1">
          <StatusPill tone={u.email_confirmed ? "success" : "warning"} label={u.email_confirmed ? t("emailOk") : t("emailPending")} />
          <StatusPill tone={u.mfa ? "success" : "neutral"} label={u.mfa ? t("mfaOn") : t("mfaOff")} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { count: all.length })} action={<AddPlatformAdmin />} />
      <section aria-labelledby="admins-title" className="mb-6 rounded-xl border bg-card p-4" data-testid="platform-admins">
        <h2 id="admins-title" className="mb-1 font-bold">{t("adminsTitle")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("adminsHint")}</p>
        <ul className="flex flex-col divide-y">
          {admins.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex flex-col">
                <span className="font-medium">{u.full_name || u.email}</span>
                <Ltr className="text-xs text-muted-foreground">{u.email}</Ltr>
              </span>
              <span className="flex items-center gap-2">
                <StatusPill tone={u.mfa ? "success" : "warning"} label={u.mfa ? t("mfaOn") : t("mfaAdvice")} />
                <RemovePlatformAdmin email={u.email} self={u.id === me?.id} />
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="mb-4 lg:max-w-sm">
        <SearchBar placeholder={t("search")} />
      </div>
      {matches.length > LIMIT ? <p className="mb-2 text-sm text-muted-foreground">{t("limited", { shown: LIMIT, total: matches.length })}</p> : null}
      <ResponsiveList rows={rows} columns={columns} rowKey={(u) => u.id} caption={t("title")} testId="platform-users" rowTestId="platform-user" />
    </>
  );
}
