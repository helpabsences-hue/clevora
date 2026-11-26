import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Service-role client: BYPASSES RLS. Server code only, and only for the few
 * operations that cannot run as the user (signup before email confirmation,
 * creating a confirmed account from an email invitation).
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
