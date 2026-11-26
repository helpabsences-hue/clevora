"use client";

import { CheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { updateLocaleAction } from "@/app/[locale]/(app)/account/actions";
import { Flag } from "@/components/app/flags";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
] as const;
type Code = (typeof LOCALES)[number]["code"];

/**
 * Language in the header: a round flag button opening the list (flag, name, ✓).
 * Stays on the same page; saved in the profile when logged in.
 */
export function LanguageSwitch({ save = true, className }: { save?: boolean; className?: string }) {
  const t = useTranslations("app");
  const current = useLocale() as Code;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, start] = useTransition();
  const choose = (code: Code) => {
    if (code === current) return;
    if (save) void updateLocaleAction(code);
    start(() => router.replace(search ? `${pathname}?${search}` : pathname, { locale: code }));
  };
  const currentName = LOCALES.find((l) => l.code === current)?.name ?? "Français";

  return (
    <div className={cn("shrink-0", className)} data-testid="language-switch">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${t("language")} : ${currentName}`}
            title={t("language")}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pending && "opacity-60",
            )}
          >
            <Flag code={current} className="size-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 rounded-xl p-1.5">
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l.code} lang={l.code} onSelect={() => choose(l.code)} className="min-h-11 gap-3 rounded-lg px-3 text-base" aria-current={current === l.code ? "true" : undefined}>
              <Flag code={l.code} className="size-5" />
              <span className="flex-1">{l.name}</span>
              {current === l.code ? <CheckIcon className="size-4 text-primary dark:text-foreground" aria-hidden /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
