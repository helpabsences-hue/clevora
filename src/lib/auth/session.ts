import "server-only";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { resolveBrandColor } from "@/lib/brand";
import { logoUrl } from "@/lib/storage";
import { computeSubscription, type SubscriptionState, type SubscriptionStatus } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/** Cookie holding the id of the agency the user is working in. It is only a
 *  preference: every request checks the user is an active member of it. */
export const ACTIVE_AGENCY_COOKIE = "parcolia_agency";

export const ACTIVE_AGENCY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export type Role = "admin" | "staff";

export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  preferredLocale: "fr" | "ar" | "en";
  preferredTheme: "light" | "dark" | "system";
};

export type Membership = {
  agencyId: string;
  role: Role;
  status: "active" | "disabled";
  agencyName: string;
  logoUrl: string | null;
};

export type ActiveAgency = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  logoPath: string | null;
  brandColor: string;
  brandForeground: string;
  role: Role;
  subscription: SubscriptionState;
  /** Inspection section turned on in Paramètres, and how it works. */
  inspection: { enabled: boolean; mode: "photos" | "video" };
};

/** The logged-in user, verified with the auth server (cached per request). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, preferred_locale, preferred_theme")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email ?? user.email ?? null,
    fullName: data.full_name,
    phone: data.phone,
    preferredLocale: data.preferred_locale as Profile["preferredLocale"],
    preferredTheme: data.preferred_theme as Profile["preferredTheme"],
  };
});

/** All agencies of the user (active and disabled memberships). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id, role, status, agencies(name, logo_path)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []).flatMap((m) =>
    m.agencies
      ? [
          {
            agencyId: m.agency_id,
            role: m.role as Role,
            status: m.status as Membership["status"],
            agencyName: m.agencies.name,
            logoUrl: logoUrl(m.agencies.logo_path),
          },
        ]
      : [],
  );
});

/** Which agency id to use: the cookie if still valid, otherwise the only active one. */
export function pickActiveAgencyId(memberships: Membership[], cookieValue: string | undefined): string | null {
  const active = memberships.filter((m) => m.status === "active");
  if (cookieValue && active.some((m) => m.agencyId === cookieValue)) return cookieValue;
  return active.length === 1 ? active[0].agencyId : null;
}

/** The agency the user works in right now, or null (no agency / must choose). */
export const getActiveAgency = cache(async (): Promise<ActiveAgency | null> => {
  const memberships = await getMemberships();
  const cookieStore = await cookies();
  const agencyId = pickActiveAgencyId(memberships, cookieStore.get(ACTIVE_AGENCY_COOKIE)?.value);
  if (!agencyId) return null;
  const membership = memberships.find((m) => m.agencyId === agencyId);
  if (!membership) return null;

  const supabase = await createClient();
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, slug, logo_path, brand_color, subscription_status, trial_ends_at, current_period_end, inspection_enabled, inspection_mode")
    .eq("id", agencyId)
    .maybeSingle();
  if (!agency) return null;

  const brand = resolveBrandColor(agency.brand_color);
  return {
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    logoPath: agency.logo_path,
    logoUrl: logoUrl(agency.logo_path),
    brandColor: brand.brand,
    brandForeground: brand.foreground,
    role: membership.role,
    subscription: computeSubscription({
      status: agency.subscription_status as SubscriptionStatus,
      trialEndsAt: agency.trial_ends_at,
      currentPeriodEnd: agency.current_period_end,
    }),
    inspection: { enabled: agency.inspection_enabled, mode: agency.inspection_mode === "video" ? "video" : "photos" },
  };
});

async function go(href: string): Promise<never> {
  const locale = await getLocale();
  redirect({ href, locale });
  throw new Error("unreachable");
}

/** Pages: must be logged in. */
export async function requireUser() {
  const user = await getUser();
  if (!user) return go("/login");
  return user;
}

/** Pages: must be logged in AND working in an agency. */
export async function requireAgency() {
  const user = await requireUser();
  const agency = await getActiveAgency();
  if (!agency) return go("/select-agency");
  return { user, agency };
}

/** Pages: must have one of these roles in the active agency (otherwise back to Aujourd'hui). */
export async function requireRole(roles: Role[]) {
  const ctx = await requireAgency();
  if (!roles.includes(ctx.agency.role)) return go("/dashboard?denied=1");
  return ctx;
}
