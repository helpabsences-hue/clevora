import { LogOutIcon, StoreIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/[locale]/(auth)/actions";
import { ModeToggle } from "@/components/app/mode-toggle";
import { ParcoliaLogo } from "@/components/app/parcolia-logo";
import { ThemeSync } from "@/components/app/theme-sync";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { getProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PlatformNav } from "./components/platform-nav";
import { LanguageSwitch } from "@/components/app/language-switch";
import { Suspense, type ReactNode } from "react";

/** Parcolia owner console: every agency, account, payment and plan. Not for agencies. */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requirePlatformAdmin();
  const profile = await getProfile();
  const t = await getTranslations("platform");
  // The owner may also run an agency: a shortcut back to it.
  const { count } = await (await createClient()).from("agency_members").select("agency_id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active");
  return (
    <div className="flex min-h-dvh flex-col">
      <ThemeSync theme={profile?.preferredTheme ?? "system"} />
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pt-2">
          <Link href="/platform" className="flex items-center gap-3 rounded-md">
            <ParcoliaLogo priority size="sm" />
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">{t("badge")}</span>
          </Link>
          <div className="flex items-center gap-1">
            {count ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <StoreIcon aria-hidden />
                  <span className="hidden sm:inline">{t("myAgency")}</span>
                </Link>
              </Button>
            ) : null}
            <Suspense>
              <LanguageSwitch />
            </Suspense>
            <ModeToggle />
            <span className="hidden flex-col px-2 text-end text-sm leading-tight sm:flex">
              <span className="font-medium">{profile?.fullName || user.email}</span>
              <span className="text-xs text-muted-foreground">{t("role")}</span>
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label={t("logout")} title={t("logout")}>
                <LogOutIcon aria-hidden />
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <PlatformNav />
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
