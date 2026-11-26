import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "fr",
  // French has no prefix (/login), Arabic and English do (/ar/login, /en/login)
  localePrefix: "as-needed",
  // The language is chosen in Paramètres / Mon compte, not guessed from the browser
  localeDetection: false,
});

export function isRtl(locale: string): boolean {
  return locale === "ar";
}

/** "/dashboard" in locale "ar" → "/ar/dashboard"; French stays "/dashboard". */
export function localizedPath(path: string, locale: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === routing.defaultLocale ? clean : `/${locale}${clean === "/" ? "" : clean}`;
}
