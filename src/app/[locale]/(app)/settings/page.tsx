import { BellIcon, BuildingIcon, ClipboardCheckIcon, DatabaseIcon, FileTextIcon, MonitorIcon, ScaleIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getProfile, requireAgency } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";
import { logoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PreferencesForm } from "../account/account-forms";
import { DataSection } from "./components/data-section";
import { AgencyForm, AlertsForm, AssistantForm, ContractForm, InspectionForm, LegalForm } from "./components/settings-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

const SECTIONS = [
  { key: "agency", icon: BuildingIcon, admin: true },
  { key: "legal", icon: ScaleIcon, admin: true },
  { key: "contract", icon: FileTextIcon, admin: true },
  { key: "alerts", icon: BellIcon, admin: true },
  { key: "inspection", icon: ClipboardCheckIcon, admin: true },
  { key: "assistant", icon: SparklesIcon, admin: true },
  { key: "display", icon: MonitorIcon, admin: false },
  { key: "data", icon: DatabaseIcon, admin: true },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon; admin: boolean }>;
type SectionKey = (typeof SECTIONS)[number]["key"];

/** Paramètres: admins manage the agency; everyone chooses language and theme. */
export default async function SettingsPage({ searchParams }: PageProps<"/[locale]/settings">) {
  const { agency } = await requireAgency();
  const isAdmin = agency.role === "admin";
  const sp = await searchParams;
  const t = await getTranslations("settings");
  const visible = SECTIONS.filter((s) => isAdmin || !s.admin);
  const section: SectionKey = visible.find((s) => s.key === sp.section)?.key ?? visible[0].key;
  const profile = await getProfile();

  let content: React.ReactNode = null;
  if (section === "display") {
    content = <PreferencesForm locale={profile?.preferredLocale ?? "fr"} theme={profile?.preferredTheme ?? "system"} />;
  } else {
    const supabase = await createClient();
    const [{ data: a }, { data: quota }] = await Promise.all([
      supabase.from("agencies").select("*").eq("id", agency.id).single(),
      section === "assistant" ? supabase.rpc("ai_quota", { p_agency: agency.id }) : Promise.resolve({ data: null }),
    ]);
    if (!a) throw new Error("Agency not found");
    const text = (v: string | null) => v ?? "";
    content = {
      agency: (
        <AgencyForm
          values={{ name: a.name, address: text(a.address), city: text(a.city), phone: formatPhone(a.phone), email: text(a.email), brand_color: a.brand_color ?? "#1E3A5F" }}
          logoUrl={logoUrl(a.logo_path)}
          userName={profile?.fullName ?? ""}
        />
      ),
      legal: <LegalForm values={{ rc: text(a.rc), ice: text(a.ice), if_number: text(a.if_number), patente: text(a.patente), cnss: text(a.cnss) }} />,
      contract: (
        <ContractForm
          nextNumber={a.next_contract_number}
          values={{
            contract_terms: text(a.contract_terms),
            contract_number_prefix: a.contract_number_prefix,
            min_driver_age: a.min_driver_age,
            min_license_years: a.min_license_years,
            default_franchise: Number(a.default_franchise),
            default_deposit: Number(a.default_deposit),
            equipment_items: a.equipment_items,
            document_items: a.document_items,
          }}
        />
      ),
      alerts: <AlertsForm values={{ alert_days_before: a.alert_days_before, alert_km_before: a.alert_km_before, alert_roles: a.alert_roles as Array<"admin" | "staff"> }} />,
      assistant: <AssistantForm values={{ ai_enabled: a.ai_enabled }} inPlan={Boolean(quota?.[0]?.plan_allows)} />,
      inspection: <InspectionForm values={{ inspection_enabled: a.inspection_enabled, inspection_mode: a.inspection_mode === "video" ? "video" : "photos" }} />,
      data: <DataSection agencyName={a.name} />,
    }[section];
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={isAdmin ? t("subtitleAdmin") : t("subtitleStaff")} />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={t("sections")}>
          <ul className="flex flex-wrap gap-2 lg:flex-col">
            {visible.map((s) => {
              const Icon = s.icon;
              const current = s.key === section;
              return (
                <li key={s.key} className="shrink-0">
                  <Link
                    href={`/settings?section=${s.key}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap",
                      current ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent lg:border-transparent lg:bg-transparent",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {t(`sections_.${s.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t(`sections_.${section}`)}</CardTitle>
            <CardDescription>{t(`descriptions.${section}`)}</CardDescription>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      </div>
    </>
  );
}
