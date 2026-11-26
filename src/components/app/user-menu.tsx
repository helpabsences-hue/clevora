"use client";

import { ArrowLeftRightIcon, ChevronDownIcon, LayoutDashboardIcon, LogOutIcon, UserCogIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Can } from "@/components/app/agency-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/app/[locale]/(auth)/actions";
import { clearReservationDrafts } from "@/app/[locale]/(app)/reservations/components/use-draft";

/** Header, right side: the user's name with the role under it, and the menu. */
export function UserMenu({
  name,
  email,
  roleLabel,
  canSwitchAgency,
  platformAdmin = false,
}: {
  name: string;
  email: string;
  roleLabel: string;
  canSwitchAgency: boolean;
  platformAdmin?: boolean;
}) {
  const t = useTranslations("app.menu");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1.5 text-start hover:bg-accent sm:px-2"
        aria-label={t("open")}
      >
        <span className="flex min-w-0 max-w-[5.5rem] flex-col leading-tight sm:max-w-56">
          <span className="truncate text-sm font-semibold" data-testid="header-user-name">
            {name}
          </span>
          <span className="truncate text-xs text-muted-foreground" data-testid="header-user-role">
            {roleLabel}
          </span>
        </span>
        <span
          aria-hidden
          className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold sm:inline-flex"
        >
          {initials || "?"}
        </span>
        <ChevronDownIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserCogIcon aria-hidden />
            {t("account")}
          </Link>
        </DropdownMenuItem>
        <Can role="admin">
          <DropdownMenuItem asChild>
            <Link href="/team" data-testid="menu-team">
              <UsersIcon aria-hidden />
              {t("team")}
            </Link>
          </DropdownMenuItem>
        </Can>
        {platformAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/platform" data-testid="menu-platform">
              <LayoutDashboardIcon aria-hidden />
              {t("platform")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canSwitchAgency ? (
          <DropdownMenuItem asChild>
            <Link href="/select-agency">
              <ArrowLeftRightIcon aria-hidden />
              {t("switchAgency")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            clearReservationDrafts(); // drafts can hold a client's details: never leave them on a shared device
            void logoutAction();
          }}
        >
          <LogOutIcon aria-hidden />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
