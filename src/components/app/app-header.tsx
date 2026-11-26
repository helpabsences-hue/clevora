import { AgencyLogo } from "@/components/app/agency-logo";
import { ModeToggle } from "@/components/app/mode-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { Link } from "@/i18n/navigation";
import { LanguageSwitch } from "@/components/app/language-switch";
import { Suspense } from "react";

/**
 * Sticky header: agency logo + name (in the sidebar on laptops), and on the
 * right the light/dark switch, the user's name with the role under it and the account menu.
 */
export function AppHeader({
  agencyName,
  agencyLogoUrl,
  userName,
  userEmail,
  roleLabel,
  canSwitchAgency,
  platformAdmin = false,
}: {
  agencyName: string;
  agencyLogoUrl: string | null;
  userName: string;
  userEmail: string;
  roleLabel: string;
  canSwitchAgency: boolean;
  /** Parcolia owner: a shortcut to the owner console. */
  platformAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg xl:invisible">
          <AgencyLogo name={agencyName} url={agencyLogoUrl} size={40} />
          <span className="line-clamp-2 text-[15px] font-bold leading-tight sm:truncate sm:text-lg" data-testid="header-agency-name">
            {agencyName}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 max-sm:gap-0.5">
          <Suspense>
            <LanguageSwitch />
          </Suspense>
          <ModeToggle />
          <UserMenu name={userName} email={userEmail} roleLabel={roleLabel} canSwitchAgency={canSwitchAgency} platformAdmin={platformAdmin} />
        </div>
      </div>
    </header>
  );
}
