"use client";

import { MenuIcon, PlusIcon, UserCogIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Link, usePathname } from "@/i18n/navigation";
import type { Role } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { NavBadge } from "./nav-badge";
import { BOTTOM_KEYS, isActive, NEW_RESERVATION_HREF, navItemsFor, type NavBadges, type NavKey } from "./nav-config";
import { PoweredBy } from "@/components/app/powered-by";

/** Phones (< 768 px): Aujourd'hui, Réservations, big +, Parc auto, Plus. */
export function BottomNav({ role, hidden = [], badges }: { role: Role; hidden?: NavKey[]; badges: NavBadges }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  // The "Plus" sheet closes by itself when the page changes.
  const [moreOpenOn, setMoreOpenOn] = useState<string | null>(null);
  const moreOpen = moreOpenOn === pathname;
  const setMoreOpen = (value: boolean) => setMoreOpenOn(value ? pathname : null);
  const items = navItemsFor(role, hidden);
  const main = BOTTOM_KEYS.map((k) => items.find((i) => i.key === k)!).filter(Boolean);
  const more = items.filter((i) => !BOTTOM_KEYS.includes(i.key));
  const moreBadge = more.reduce((n, i) => n + (badges[i.key]?.count ?? 0), 0);
  const moreActive = more.some((i) => isActive(pathname, i.href)) || isActive(pathname, "/account");


  const tab = (key: string, href: string, label: string, Icon: LucideIcon, badge?: { count: number; tone: "danger" | "warning" }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
          active ? "text-primary dark:text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className="size-6" />
        <span className="max-w-full truncate px-0.5">{label}</span>
        {badge ? <NavBadge count={badge.count} tone={badge.tone} className="absolute top-1 start-1/2 ms-2 h-4 min-w-4 px-1 text-[10px]" /> : null}
      </Link>
    );
  };

  const [dashboard, reservations, fleet] = main;

  return (
    <>
      <nav
        aria-label={t("label")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {dashboard ? tab(dashboard.key, dashboard.href, t(dashboard.key), dashboard.icon, badges[dashboard.key]) : null}
          {reservations ? tab(reservations.key, reservations.href, t(reservations.key), reservations.icon, badges[reservations.key]) : null}
          <div className="flex flex-1 items-center justify-center">
            <Link
              href={NEW_RESERVATION_HREF}
              aria-label={t("newReservation")}
              className="-mt-6 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
            >
              <PlusIcon className="size-7" aria-hidden />
            </Link>
          </div>
          {fleet ? tab(fleet.key, fleet.href, t(fleet.key), fleet.icon, badges[fleet.key]) : null}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              moreActive ? "text-primary dark:text-foreground" : "text-muted-foreground",
            )}
          >
            <MenuIcon className="size-6" aria-hidden />
            <span>{t("more")}</span>
            {moreBadge ? <NavBadge count={moreBadge} tone="warning" className="absolute top-1 start-1/2 ms-2 h-4 min-w-4 px-1 text-[10px]" /> : null}
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent closeLabel={tc("close")} className="md:hidden">
          <DialogTitle>{t("more")}</DialogTitle>
          <DialogDescription className="sr-only">{t("moreDescription")}</DialogDescription>
          <ul className="grid grid-cols-3 gap-2">
            {[...more, { key: "account", href: "/account", icon: UserCogIcon }].map((item) => {
              const Icon = item.icon;
              const badge = badges[item.key as keyof NavBadges];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-sm font-medium",
                      active ? "border-primary bg-primary/5 dark:border-ring" : "hover:bg-accent",
                    )}
                  >
                    <Icon className="size-6 text-muted-foreground" aria-hidden />
                    <span className="leading-tight">{t(item.key)}</span>
                    {badge ? <NavBadge count={badge.count} tone={badge.tone} className="absolute end-1.5 top-1.5" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-center text-xs text-muted-foreground">
            <PoweredBy label={t("poweredBy")} />
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
