"use client";

import { BuildingIcon, CreditCardIcon, LayoutDashboardIcon, PackageIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "dashboard", href: "/platform", icon: LayoutDashboardIcon },
  { key: "agencies", href: "/platform/agencies", icon: BuildingIcon },
  { key: "users", href: "/platform/users", icon: UsersIcon },
  { key: "payments", href: "/platform/payments", icon: CreditCardIcon },
  { key: "plans", href: "/platform/plans", icon: PackageIcon },
] as const;

/** Owner console menu: a scrollable row of tabs (fits phones without page scroll). */
export function PlatformNav() {
  const t = useTranslations("platform.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ITEMS.map(({ key, href, icon: Icon }) => {
        const active = href === "/platform" ? pathname === "/platform" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground dark:border-ring" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
