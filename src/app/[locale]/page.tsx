import {
  BellRingIcon,
  CalendarRangeIcon,
  CarIcon,
  CheckIcon,
  FileSignatureIcon,
  LanguagesIcon,
  MessageCircleIcon,
  SmartphoneIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense, type ComponentProps, type ReactNode } from "react";
import { LocaleLinks } from "@/components/app/locale-links";
import { Ltr } from "@/components/app/ltr";
import { ParcoliaLogo } from "@/components/app/parcolia-logo";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { localizedPath } from "@/i18n/routing";
import { whatsappNumber } from "@/lib/phone";
import { getUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/app/mode-toggle";
import { LanguageSwitch } from "@/components/app/language-switch";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: { absolute: t("metaTitle") }, description: t("metaDescription") };
}

const FEATURES: Array<{ key: string; icon: LucideIcon }> = [
  { key: "contracts", icon: FileSignatureIcon },
  { key: "planning", icon: CalendarRangeIcon },
  { key: "fleet", icon: CarIcon },
  { key: "alerts", icon: BellRingIcon },
  { key: "money", icon: WalletIcon },
  { key: "team", icon: UsersIcon },
  { key: "assistant", icon: SparklesIcon },
  { key: "mobile", icon: SmartphoneIcon },
  { key: "languages", icon: LanguagesIcon },
];

/**
 * Link to an app page. When the marketing site has its own domain
 * (NEXT_PUBLIC_MARKETING_URL), app pages live on NEXT_PUBLIC_SITE_URL: plain <a>.
 */
function AppLink({ href, locale, children, ...rest }: { href: string; locale: string; children: ReactNode } & Omit<ComponentProps<"a">, "href">) {
  // ...rest carries the button styles (Button asChild passes className to its child).
  const split = process.env.NEXT_PUBLIC_MARKETING_URL && process.env.NEXT_PUBLIC_MARKETING_URL !== process.env.NEXT_PUBLIC_SITE_URL;
  if (!split) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={`${process.env.NEXT_PUBLIC_SITE_URL}${localizedPath(href, locale)}`} {...rest}>
      {children}
    </a>
  );
}

/** Parcolia marketing home. Logged-in users go straight to their agency. */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (await getUser()) redirect({ href: "/dashboard", locale });
  const t = await getTranslations("marketing");
  const support = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.trim() || null;
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("code, name, price_mad_month, price_mad_year, max_vehicles, max_users, ai_enabled, ai_monthly_questions")
    .eq("active", true)
    .order("price_mad_month");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/" aria-label="Parcolia" className="rounded-md">
            <ParcoliaLogo size="sm" priority />
          </Link>
          <nav aria-label={t("navLabel")} className="flex items-center gap-1">
            <Suspense>
              <LanguageSwitch save={false} />
            </Suspense>
            <ModeToggle save={false} className="hidden sm:inline-flex" />
            <a href="#tarifs" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-accent sm:inline-flex">{t("navPricing")}</a>
            <Button variant="ghost" asChild>
              <AppLink href="/login" locale={locale}>{t("login")}</AppLink>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <AppLink href="/signup" locale={locale}>{t("tryFree")}</AppLink>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pb-16 pt-12 text-center sm:pt-20">
          <Image src="/brand/parcolia-logo.png" alt="" width={240} height={162} priority className="h-auto w-48 sm:w-60 dark:hidden" />
          <Image src="/brand/parcolia-logo-dark.png" alt="" width={240} height={162} priority className="hidden h-auto w-48 sm:w-60 dark:block" />
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">{t("badge")}</span>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">{t("heroTitle")}</h1>
          <p className="max-w-2xl text-pretty text-lg text-muted-foreground">{t("heroBody")}</p>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" asChild>
              <AppLink href="/signup" locale={locale}>{t("ctaTrial")}</AppLink>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#fonctions">{t("ctaFeatures")}</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("noCard")}</p>
        </section>

        <section id="fonctions" aria-labelledby="features-title" className="border-y bg-muted/40 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="features-title" className="mb-2 text-center text-3xl font-bold">{t("featuresTitle")}</h2>
            <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">{t("featuresBody")}</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ key, icon: Icon }) => (
                <li key={key} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
                  <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`features.${key}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="steps-title" className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="steps-title" className="mb-10 text-center text-3xl font-bold">{t("stepsTitle")}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex gap-4 rounded-xl border bg-card p-5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{n}</span>
                <div>
                  <h3 className="font-semibold">{t(`steps.${n}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`steps.${n}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="tarifs" aria-labelledby="pricing-title" className="border-y bg-muted/40 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="pricing-title" className="mb-2 text-center text-3xl font-bold">{t("pricingTitle")}</h2>
            <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">{t("pricingBody")}</p>
            <ul className="grid gap-4 md:grid-cols-3" data-testid="marketing-plans">
              {(plans ?? []).map((p) => (
                <li key={p.code} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5", p.code === "pro" && "border-primary ring-1 ring-primary")}>
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p>
                    <span className="text-3xl font-extrabold"><Ltr>{formatMoney(p.price_mad_month)}</Ltr></span>{" "}
                    <span className="text-sm text-muted-foreground">{t("perMonth")}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("orYear")} <Ltr>{formatMoney(p.price_mad_year)}</Ltr>
                  </p>
                  <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                    {[
                      p.max_vehicles === null ? t("plan.carsUnlimited") : t("plan.cars", { count: p.max_vehicles }),
                      p.max_users === null ? t("plan.usersUnlimited") : t("plan.users", { count: p.max_users }),
                      t("plan.contracts"),
                      p.ai_enabled ? t("plan.ai", { count: p.ai_monthly_questions ?? 0 }) : null,
                    ]
                      .filter(Boolean)
                      .map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                          {f}
                        </li>
                      ))}
                  </ul>
                  <Button size="lg" variant={p.code === "pro" ? "default" : "outline"} asChild>
                    <AppLink href="/signup" locale={locale}>{t("ctaTrial")}</AppLink>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-sm text-muted-foreground">{t("pricesTtc")}</p>
          </div>
        </section>

        <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-16">
          <h2 id="faq-title" className="mb-6 text-center text-3xl font-bold">{t("faqTitle")}</h2>
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <details key={n} className="rounded-xl border bg-card px-4">
                <summary className="flex min-h-12 cursor-pointer items-center font-semibold">{t(`faq.${n}.q`)}</summary>
                <p className="pb-4 text-muted-foreground">{t(`faq.${n}.a`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-primary px-4 py-14 text-center text-primary-foreground">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t("finalTitle")}</h2>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <AppLink href="/signup" locale={locale}>{t("ctaTrial")}</AppLink>
            </Button>
            {support ? (
              <Button size="lg" variant="outline" asChild className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <a href={`https://wa.me/${whatsappNumber(support)}`} target="_blank" rel="noopener noreferrer" data-testid="support-whatsapp">
                  <MessageCircleIcon aria-hidden />
                  {t("whatsapp")}
                </a>
              </Button>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="flex flex-col items-center gap-2 border-t px-4 py-6 text-sm text-muted-foreground">
        <Suspense>
          <LocaleLinks />
        </Suspense>
        <p>
          {support ? (
            <>
              <a href={`https://wa.me/${whatsappNumber(support)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {t("support")} <Ltr>{support}</Ltr>
              </a>{" "}
              ·{" "}
            </>
          ) : null}
          © {new Date().getFullYear()} Parcolia · {t("footer")} ·{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            {t("privacy")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
