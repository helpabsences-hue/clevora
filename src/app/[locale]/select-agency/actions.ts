"use server";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { fail, type ActionResult } from "@/lib/action-result";
import { ACTIVE_AGENCY_COOKIE, ACTIVE_AGENCY_COOKIE_OPTIONS, getMemberships, getUser } from "@/lib/auth/session";

/** Switch the active agency. The id comes from the browser, so it is checked
 *  against the user's active memberships before it is stored. */
export async function switchAgencyAction(agencyId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(agencyId).success) return fail("forbidden");
  const user = await getUser();
  if (!user) return fail("notLoggedIn");
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.agencyId === agencyId && m.status === "active")) return fail("forbidden");
  (await cookies()).set(ACTIVE_AGENCY_COOKIE, agencyId, ACTIVE_AGENCY_COOKIE_OPTIONS);
  redirect({ href: "/dashboard", locale: await getLocale() });
  return fail("unknown");
}
