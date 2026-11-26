import "server-only";
import { fail } from "@/lib/action-result";
import { getActiveAgency, getUser, type ActiveAgency, type Role } from "@/lib/auth/session";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type ActionContext = {
  supabase: ServerSupabase;
  user: User;
  agency: ActiveAgency;
};

type Options = {
  /** Roles allowed to run the action (default: everyone in the agency). */
  roles?: Role[];
  /** The action changes data: refuse it in read-only mode (default true). */
  write?: boolean;
};

/**
 * Server actions: check login, active agency, role and read-only mode.
 * Returns the context, or a failed ActionResult to return as-is.
 * RLS enforces the same rules again in the database.
 */
export async function requireActionContext(
  options: Options = {},
): Promise<{ ok: true; ctx: ActionContext } | ReturnType<typeof fail>> {
  const user = await getUser();
  if (!user) return fail("notLoggedIn");
  const agency = await getActiveAgency();
  if (!agency) return fail("noAgency");
  if (options.roles && !options.roles.includes(agency.role)) return fail("forbidden");
  if (options.write !== false && !agency.subscription.writable) return fail("readOnly");
  const supabase = await createClient();
  return { ok: true, ctx: { supabase, user, agency } };
}

/** Maps Postgres / PostgREST errors to translation keys of the "errors" namespace. */
export function dbErrorKey(error: { code?: string; message?: string; hint?: string } | null | undefined): string {
  if (!error) return "unknown";
  if (error.hint === "last_admin") return "lastAdmin";
  if (error.hint === "plan_limit_users") return "planLimitUsers";
  if (error.hint === "plan_limit_vehicles") return "planLimitVehicles";
  if (error.hint === "vehicle_in_maintenance") return "vehicleInMaintenance";
  if (error.hint === "vehicle_insurance_expired") return "vehicleInsuranceExpired";
  if (error.hint === "reservation_not_reserved") return "reservationStarted";
  if (error.code === "23514" && error.message?.includes("car_before_signing")) return "carMissing";
  if (error.code === "42501") return "forbidden";
  if (error.code === "23505") return "duplicate";
  if (error.code === "23P01") return "doubleBooking";
  return "unknown";
}
