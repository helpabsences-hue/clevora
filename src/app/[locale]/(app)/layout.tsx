import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { AgencyProvider } from "@/components/app/agency-context";
import { AppHeader } from "@/components/app/app-header";
import { BrandStyle } from "@/components/app/brand-style";
import { NoticeToast } from "@/components/app/notice-toast";
import { BottomNav } from "@/components/app/shell/bottom-nav";
import type { NavKey } from "@/components/app/shell/nav-config";
import { Sidebar } from "@/components/app/shell/sidebar";
import { SubscriptionBanner } from "@/components/app/subscription-banner";
import { ThemeSync } from "@/components/app/theme-sync";
import { getMemberships, getProfile, requireAgency } from "@/lib/auth/session";
import { getNavBadges } from "@/lib/nav-badges";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/auth/platform";

/**
 * The app shell (everything inside an agency):
 *  phone  < 768   sticky header + bottom navigation
 *  tablet 768–1279 icon rail that opens over the content
 *  laptop ≥ 1280  fixed sidebar + sticky header
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, agency } = await requireAgency();
  const supabase = await createClient();
  const [profile, memberships, badges, tr] = await Promise.all([
    getProfile(),
    getMemberships(),
    getNavBadges(supabase, agency.id, { inspection: agency.inspection.enabled }),
    getTranslations("roles"),
  ]);
  const hidden: NavKey[] = agency.inspection.enabled ? [] : ["inspections"];
  const activeAgencies = memberships.filter((m) => m.status === "active").length;

  return (
    <AgencyProvider
      value={{ id: agency.id, name: agency.name, role: agency.role, writable: agency.subscription.writable }}
    >
      <BrandStyle brand={agency.brandColor} foreground={agency.brandForeground} />
      <ThemeSync theme={profile?.preferredTheme ?? "system"} />
      <Sidebar role={agency.role} hidden={hidden} badges={badges} agencyName={agency.name} agencyLogoUrl={agency.logoUrl} />
      <div className="flex min-h-dvh flex-col md:ps-16 xl:ps-64">
        <AppHeader
          agencyName={agency.name}
          agencyLogoUrl={agency.logoUrl}
          userName={profile?.fullName || user.email || ""}
          userEmail={user.email ?? ""}
          roleLabel={tr(agency.role)}
          canSwitchAgency={activeAgencies > 1}
          platformAdmin={await isPlatformAdmin()}
        />
        <SubscriptionBanner subscription={agency.subscription} role={agency.role} />
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-4 sm:pt-6 md:pb-8">{children}</main>
      </div>
      <BottomNav role={agency.role} hidden={hidden} badges={badges} />
      <Suspense>
        <NoticeToast />
      </Suspense>
    </AgencyProvider>
  );
}
