import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Is the logged-in user Parcolia staff (public.platform_admins)? Checked in the database. */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});

/** /platform pages: anyone else gets a plain 404 (the area is not advertised). */
export async function requirePlatformAdmin() {
  const user = await getUser();
  if (!user || !(await isPlatformAdmin())) notFound();
  return user;
}
