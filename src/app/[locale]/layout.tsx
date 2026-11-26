import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-namespaces";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorker } from "@/components/app/service-worker";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Providers } from "@/components/app/providers";
import { isRtl, routing } from "@/i18n/routing";

const latin = Inter({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1120" },
  ],
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });
  return {
    title: { default: "Parcolia", template: "%s · Parcolia" },
    description: t("tagline"),
    applicationName: "Parcolia",
    appleWebApp: { capable: true, title: "Parcolia", statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
    formatDetection: { telephone: false },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${latin.variable} ${arabic.variable}`} suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to <body> */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <NextIntlClientProvider messages={pickMessages(await getMessages(), CLIENT_NAMESPACES)}>
          <Providers dir={dir}>{children}</Providers>
          <ServiceWorker />
          {/* Page views on Vercel (no cookies, no personal data). */}
          {process.env.VERCEL ? <Analytics /> : null}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
