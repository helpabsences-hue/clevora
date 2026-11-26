import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { ParcoliaLogo } from "@/components/app/parcolia-logo";
import { LocaleLinks } from "@/components/app/locale-links";
import { Link } from "@/i18n/navigation";
import { ModeToggle } from "@/components/app/mode-toggle";
import { LanguageSwitch } from "@/components/app/language-switch";

/** Parcolia-branded pages: login, signup, password reset, invitation. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("brand");
  return (
    <div className="flex min-h-dvh flex-col bg-muted/60 dark:bg-background">
      <div className="flex justify-end gap-2 px-4 pt-3">
        <Suspense>
          <LanguageSwitch />
        </Suspense>
        <ModeToggle save={false} />
      </div>
      <header className="flex flex-col items-center gap-2 px-4 pb-4 pt-2 text-center sm:pt-6">
        <Link href="/login" aria-label="Parcolia" className="rounded-lg">
          <ParcoliaLogo priority />
        </Link>
        <p className="text-sm text-muted-foreground">{t("tagline")}</p>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">{children}</main>
      <footer className="flex flex-col items-center gap-1 px-4 pb-6 text-xs text-muted-foreground">
        <Suspense>
          <LocaleLinks />
        </Suspense>
        <p>
          © {new Date().getFullYear()} Parcolia ·{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            {t("privacy")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
