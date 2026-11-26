"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AgencyLogo } from "@/components/app/agency-logo";
import { Link, usePathname } from "@/i18n/navigation";
import type { Role } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { NavBadge } from "./nav-badge";
import { isActive, NAV_SECTIONS, navItemsFor, type NavBadges, type NavItem, type NavKey } from "./nav-config";
import { PoweredBy } from "@/components/app/powered-by";

/**
 * Tablet (768–1279 px): icon rail; tap the top button to open it over the content.
 * Laptop (≥1280 px): fixed full sidebar that does not scroll with the page.
 * Phones use <BottomNav> instead.
 */
export function Sidebar({
  role,
  hidden = [],
  badges,
  agencyName,
  agencyLogoUrl,
}: {
  role: Role;
  hidden?: NavKey[];
  badges: NavBadges;
  agencyName: string;
  agencyLogoUrl: string | null;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // Remember on which page the rail was opened: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean | ((v: boolean) => boolean)) =>
    setOpenOn((typeof value === "function" ? value(open) : value) ? pathname : null);
  const items = navItemsFor(role, hidden);

  // Escape closes the expanded rail
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={t("collapse")}
          className="fixed inset-0 z-40 bg-black/40 xl:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 hidden flex-col border-e bg-card md:flex",
          open ? "w-64 shadow-xl" : "w-16",
          "xl:w-64 xl:shadow-none",
        )}
        aria-label={t("label")}
      >
        <div className={cn("flex h-16 shrink-0 items-center gap-2 border-b px-3", !open && "justify-center xl:justify-start")}>
          <AgencyLogo name={agencyName} url={agencyLogoUrl} size={36} className={cn(!open && "hidden xl:inline-flex")} />
          <span className={cn("min-w-0 flex-1 truncate font-bold", !open && "hidden xl:block")}>{agencyName}</span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground xl:hidden"
            aria-label={open ? t("collapse") : t("expand")}
            aria-expanded={open}
          >
            {open ? <PanelLeftCloseIcon className="size-5 rtl:rotate-180" /> : <PanelLeftOpenIcon className="size-5 rtl:rotate-180" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:none] xl:px-2 xl:py-1.5 shorter:py-1 [&::-webkit-scrollbar]:hidden">
          {NAV_SECTIONS.map((section, si) => {
            const list = section.items.map((k) => items.find((i) => i.key === k)).filter((i): i is NavItem => Boolean(i));
            if (!list.length) return null;
            return (
              <div key={section.key} className={cn(si > 0 && "mt-1.5 border-t pt-1.5 shorter:mt-1 shorter:pt-1 xl:mt-1 xl:border-t-0 xl:pt-0 short:xl:border-t short:xl:pt-1", si > 0 && open && "border-t-0 pt-0")}>
                <p className={cn("px-3 text-[10px] leading-5 font-semibold tracking-wider text-muted-foreground/80 uppercase short:hidden", !open && "hidden xl:block")}>
                  {t(`sections.${section.key}`)}
                </p>
                <ul className="flex flex-col gap-0.5 shorter:gap-0 xl:gap-px">
                  {list.map((item) => {
                    const active = isActive(pathname, item.href);
                    const badge = badges[item.key];
                    const Icon = item.icon;
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          title={open ? undefined : t(item.key)}
                          className={cn(
                            "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors short:min-h-10 shorter:min-h-[34px] xl:min-h-8 xl:gap-2.5 xl:text-[13px] short:xl:min-h-8 shorter:xl:min-h-8",
                            active
                              ? "bg-primary/10 text-primary before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-primary dark:bg-accent dark:text-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            !open && "justify-center px-0 xl:justify-start xl:px-3",
                          )}
                        >
                          <Icon className="size-5 shrink-0 xl:size-4" aria-hidden />
                          <span className={cn("flex-1 truncate", !open && "sr-only xl:not-sr-only")}>{t(item.key)}</span>
                          {badge ? (
                            <NavBadge
                              count={badge.count}
                              tone={badge.tone}
                              className={cn(!open && "absolute -top-0.5 end-0.5 h-4 min-w-4 px-1 text-[10px] xl:static xl:h-5 xl:min-w-5 xl:px-1.5 xl:text-xs")}
                            />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <p className={cn("border-t px-3 py-2 text-xs text-muted-foreground shorter:py-1", !open && "hidden xl:block")}>
          <PoweredBy label={t("poweredBy")} />
        </p>
      </aside>
    </>
  );
}
