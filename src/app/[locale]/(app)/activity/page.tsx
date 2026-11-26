import {
  BotIcon,
  CarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSignatureIcon,
  HistoryIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Ltr } from "@/components/app/ltr";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { dayKey, formatMoney, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("activity");
  return { title: t("title") };
}

const PAGE_SIZE = 50;

/** Filter groups → the action prefixes they cover. */
const TYPES: Record<string, { prefixes: string[]; icon: LucideIcon }> = {
  reservations: { prefixes: ["reservation.", "contract."], icon: FileSignatureIcon },
  fleet: { prefixes: ["vehicle."], icon: CarIcon },
  charges: { prefixes: ["charge."], icon: WalletIcon },
  team: { prefixes: ["member."], icon: UsersIcon },
  agency: { prefixes: ["settings.", "data.", "billing."], icon: SettingsIcon },
  assistant: { prefixes: ["assistant."], icon: BotIcon },
};
const typeOf = (action: string) => Object.entries(TYPES).find(([, v]) => v.prefixes.some((p) => action.startsWith(p)))?.[0] ?? "agency";

type Json = Record<string, unknown> | null;
const get = (o: Json, ...path: string[]): unknown => path.reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), o);

/** Journal d'activité: who did what, when (admins only; RLS lets only admins read it). */
export default async function ActivityPage({ searchParams }: PageProps<"/[locale]/activity">) {
  const { agency } = await requireRole(["admin"]);
  const sp = await searchParams;
  const t = await getTranslations("activity");
  const format = await getFormatter();
  const page = Math.max(1, Number(sp.page) || 1);
  const type = typeof sp.type === "string" && sp.type in TYPES ? sp.type : null;
  const who = typeof sp.who === "string" && /^[0-9a-f-]{36}$/.test(sp.who) ? sp.who : null;
  const supabase = await createClient();

  let query = supabase
    .from("activity_log")
    .select("id, created_at, actor_id, action, entity, entity_id, details", { count: "exact" })
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type) query = query.or(TYPES[type].prefixes.map((p) => `action.like.${p}%`).join(","));
  if (who) query = query.eq("actor_id", who);
  const [{ data, count }, { data: members }] = await Promise.all([
    query,
    supabase.from("agency_members").select("user_id, profile:profiles!agency_members_user_id_fkey(full_name, email)").eq("agency_id", agency.id),
  ]);
  const rows = data ?? [];

  // Names for the people and the things in the entries
  const people = new Map((members ?? []).map((m) => [m.user_id, m.profile?.full_name || m.profile?.email || "—"]));
  const resIds = [...new Set(rows.filter((r) => r.entity === "reservation" && r.entity_id).map((r) => r.entity_id!))];
  const carIds = [...new Set(rows.filter((r) => r.entity === "vehicle" && r.entity_id).map((r) => r.entity_id!))];
  const [{ data: res }, { data: cars }] = await Promise.all([
    resIds.length ? supabase.from("reservations").select("id, contract_number").in("id", resIds) : Promise.resolve({ data: [] }),
    carIds.length ? supabase.from("vehicles").select("id, plate, brand_model").in("id", carIds) : Promise.resolve({ data: [] }),
  ]);
  const contract = new Map((res ?? []).map((r) => [r.id, r.contract_number]));
  const car = new Map((cars ?? []).map((c) => [c.id, `${c.brand_model} ${c.plate}`]));

  const describe = (r: (typeof rows)[number]) => {
    const d = r.details as Json;
    const name = r.actor_id ? (people.get(r.actor_id) ?? t("someone")) : t("system");
    let what = "";
    let href: string | null = null;
    if (r.entity === "reservation" && r.entity_id) {
      what = contract.get(r.entity_id) ?? String(get(d, "new", "contract_number") ?? get(d, "old", "contract_number") ?? "");
      href = contract.has(r.entity_id) ? `/reservations/${r.entity_id}` : null;
    } else if (r.entity === "vehicle" && r.entity_id) {
      what = car.get(r.entity_id) ?? String(get(d, "old", "plate") ?? get(d, "new", "plate") ?? "");
      href = car.has(r.entity_id) ? `/fleet/${r.entity_id}` : null;
    } else if (r.entity === "charge") {
      const amount = get(d, "new", "amount") ?? get(d, "old", "amount");
      what = amount !== undefined ? formatMoney(Number(amount)) : "";
    } else if (r.entity === "member") {
      const uid = String(get(d, "new", "user_id") ?? get(d, "old", "user_id") ?? "");
      what = people.get(uid) ?? "";
    } else if (r.action === "settings.update") {
      what = String(get(d, "section") ?? "");
    }
    const changed = get(d, "changes") as Record<string, unknown> | undefined;
    const fields = changed ? Object.keys(changed).filter((k) => !["updated_at"].includes(k)) : [];
    // Translation keys cannot contain dots: "settings.update" → "settings_update"
    const key = `actions.${r.action.replace(/\./g, "_")}`;
    const known = t.has(key);
    return {
      name,
      sentence: known ? t(key, { what: what || "—" }) : `${r.action} ${what}`,
      fields: fields.map((f) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f)).slice(0, 6),
      href,
    };
  };

  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = dayKey(r.created_at);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur = { type, who, page: String(page), ...patch };
    for (const [k, v] of Object.entries(cur)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `/activity?${s}` : "/activity";
  };
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const chip = (active: boolean) =>
    cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex flex-col gap-3">
        <nav aria-label={t("filterType")} className="flex flex-wrap gap-2">
          <Link href={qs({ type: null, page: null })} aria-current={!type ? "page" : undefined} className={chip(!type)}>
            {t("types.all")}
          </Link>
          {Object.entries(TYPES).map(([k, v]) => {
            const Icon = v.icon;
            return (
              <Link key={k} href={qs({ type: k, page: null })} aria-current={type === k ? "page" : undefined} className={chip(type === k)}>
                <Icon className="size-4" aria-hidden />
                {t(`types.${k}`)}
              </Link>
            );
          })}
        </nav>
        <nav aria-label={t("filterWho")} className="flex flex-wrap gap-2">
          <Link href={qs({ who: null, page: null })} aria-current={!who ? "page" : undefined} className={chip(!who)}>
            {t("everyone")}
          </Link>
          {[...people.entries()].map(([id, n]) => (
            <Link key={id} href={qs({ who: id, page: null })} aria-current={who === id ? "page" : undefined} className={chip(who === id)}>
              {n}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={HistoryIcon} title={t("empty")} />
      ) : (
        <div className="flex flex-col gap-4" data-testid="activity-list">
          {[...byDay.entries()].map(([day, items]) => (
            <section key={day} className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-label={day}>
              <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold first-letter:uppercase">
                {format.dateTime(new Date(`${day}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </h2>
              <ul className="divide-y">
                {items.map((r) => {
                  const Icon = TYPES[typeOf(r.action)].icon;
                  const x = describe(r);
                  const body = (
                    <>
                      <span className="font-semibold">{x.name}</span> {x.sentence}
                      {x.fields.length ? <span className="block text-xs text-muted-foreground">{t("changed", { fields: x.fields.join(", ") })}</span> : null}
                    </>
                  );
                  return (
                    <li key={r.id} className="flex items-start gap-3 px-4 py-3" data-testid="activity-row">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
                        {x.href ? (
                          <Link href={x.href} className="hover:underline">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
                      </span>
                      <Ltr className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(r.created_at)}</Ltr>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {pages > 1 ? (
            <nav aria-label={t("pages")} className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" asChild={page > 1} disabled={page <= 1} aria-label={page > 1 ? undefined : t("previous")}>
                {page > 1 ? (
                  <Link href={qs({ page: String(page - 1) })} aria-label={t("previous")}>
                    <ChevronLeftIcon className="rtl:rotate-180" aria-hidden />
                  </Link>
                ) : (
                  <ChevronLeftIcon className="rtl:rotate-180" aria-hidden />
                )}
              </Button>
              <span className="text-sm">{t("pageOf", { page, pages })}</span>
              <Button variant="outline" size="icon" asChild={page < pages} disabled={page >= pages} aria-label={page < pages ? undefined : t("next")}>
                {page < pages ? (
                  <Link href={qs({ page: String(page + 1) })} aria-label={t("next")}>
                    <ChevronRightIcon className="rtl:rotate-180" aria-hidden />
                  </Link>
                ) : (
                  <ChevronRightIcon className="rtl:rotate-180" aria-hidden />
                )}
              </Button>
            </nav>
          ) : null}
        </div>
      )}
    </>
  );
}
