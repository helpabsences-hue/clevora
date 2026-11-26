import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleLinks } from "@/components/app/locale-links";
import { ParcoliaLogo } from "@/components/app/parcolia-logo";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacyPolicy");
  return { title: t("title") };
}

const SECTIONS = ["who", "data", "why", "ai", "where", "keep", "rights", "security"] as const;

/** Politique de confidentialité (loi 09-08, CNDP). Public page. */
export default async function PrivacyPage() {
  const t = await getTranslations("privacyPolicy");
  const cndp = process.env.NEXT_PUBLIC_CNDP_NUMBER;
  const contact = process.env.PARCOLIA_PRIVACY_EMAIL || process.env.PARCOLIA_BILLING_EMAIL || "contact@parcolia.ma";
  // e.g. "Union européenne, Francfort" — set it to the region of your Supabase project
  const region = process.env.PARCOLIA_DATA_REGION || t("defaultRegion");
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
          <Link href="/" aria-label="Parcolia" className="rounded-md">
            <ParcoliaLogo size="sm" priority />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
        <p className="mb-8 text-muted-foreground">{t("intro")}</p>
        <div className="flex flex-col gap-6">
          {SECTIONS.map((s) => (
            <section key={s} aria-labelledby={`p-${s}`}>
              <h2 id={`p-${s}`} className="mb-2 text-xl font-semibold">{t(`${s}.title`)}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{t(`${s}.body`, { contact, region })}</p>
            </section>
          ))}
          <section aria-labelledby="p-cndp">
            <h2 id="p-cndp" className="mb-2 text-xl font-semibold">{t("cndp.title")}</h2>
            <p className="leading-relaxed text-muted-foreground">{cndp ? t("cndp.body", { number: cndp }) : t("cndp.pending")}</p>
          </section>
        </div>
        <p className="mt-10 text-sm text-muted-foreground">{t("updated")}</p>
      </main>
      <footer className="flex flex-col items-center gap-2 border-t px-4 py-6 text-sm text-muted-foreground">
        <Suspense>
          <LocaleLinks />
        </Suspense>
        <p>© {new Date().getFullYear()} Parcolia</p>
      </footer>
    </div>
  );
}
