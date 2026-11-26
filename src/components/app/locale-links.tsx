"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LABELS = { fr: "Français", ar: "العربية", en: "English" } as const;

/** Language links for pages used before login (in the app, it lives in Paramètres). */
export function LocaleLinks() {
  const current = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = search ? `${pathname}?${search}` : pathname;
  return (
    <nav aria-label="Language" className="flex flex-wrap items-center justify-center gap-1">
      {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((locale) => (
        <Link
          key={locale}
          href={href}
          locale={locale}
          lang={locale}
          aria-current={current === locale ? "true" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            current === locale && "font-semibold text-foreground",
          )}
        >
          {LABELS[locale]}
        </Link>
      ))}
    </nav>
  );
}
