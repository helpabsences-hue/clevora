import { BuildingIcon, LogOutIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ParcoliaLogo } from "@/components/app/parcolia-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getMemberships, requireUser } from "@/lib/auth/session";
import { logoutAction } from "../(auth)/actions";
import { AgencyChoice } from "./agency-choice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("selectAgency");
  return { title: t("title") };
}

export default async function SelectAgencyPage() {
  await requireUser();
  const t = await getTranslations("selectAgency");
  const tr = await getTranslations("roles");
  const memberships = await getMemberships();
  const active = memberships.filter((m) => m.status === "active");
  const disabled = memberships.filter((m) => m.status === "disabled");

  return (
    <div className="flex min-h-dvh flex-col items-center bg-muted/60 px-4 py-8 dark:bg-background">
      <ParcoliaLogo className="mb-6" priority />
      <main className="flex w-full max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-bold">{active.length ? t("title") : t("noAgencyTitle")}</h1>
        <p className="text-muted-foreground">{active.length ? t("subtitle") : t("noAgencyBody")}</p>

        {active.length ? (
          <ul className="flex flex-col gap-2">
            {active.map((m) => (
              <li key={m.agencyId}>
                <AgencyChoice agencyId={m.agencyId} name={m.agencyName} logoUrl={m.logoUrl} roleLabel={tr(m.role)} />
              </li>
            ))}
          </ul>
        ) : null}

        {disabled.length ? (
          <Card>
            <CardContent className="flex flex-col gap-2 pt-4 sm:pt-6">
              <p className="text-sm font-medium">{t("disabledTitle")}</p>
              <ul className="flex flex-col gap-2">
                {disabled.map((m) => (
                  <li key={m.agencyId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <BuildingIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{m.agencyName}</span>
                    </span>
                    <Badge variant="neutral">{t("disabledBadge")}</Badge>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">{t("disabledHelp")}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant={active.length ? "outline" : "default"} size="lg" className="flex-1">
            <Link href="/signup">
              <PlusIcon aria-hidden />
              {t("createAgency")}
            </Link>
          </Button>
          <form action={logoutAction} className="flex-1">
            <Button type="submit" variant="ghost" size="lg" className="w-full">
              <LogOutIcon aria-hidden />
              {t("logout")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
