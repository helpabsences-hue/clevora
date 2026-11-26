"use server";

import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { localizedPath, type Locale } from "@/i18n/routing";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey } from "@/lib/auth/action";
import { ACTIVE_AGENCY_COOKIE, ACTIVE_AGENCY_COOKIE_OPTIONS } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { acceptInviteSchema, type AcceptInviteInput } from "../../schema";

function inviteErrorKey(error: { code?: string; message?: string; hint?: string }): string {
  if (error.message?.includes("autre adresse")) return "inviteOtherEmail";
  if (error.code === "P0001" && !error.hint) return "inviteInvalid";
  return dbErrorKey(error);
}

async function joinAndGo(supabase: ServerSupabase, token: string, locale: Locale): Promise<ActionResult> {
  const { data: agencyId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !agencyId) return fail(inviteErrorKey(error ?? {}));
  (await cookies()).set(ACTIVE_AGENCY_COOKIE, agencyId, ACTIVE_AGENCY_COOKIE_OPTIONS);
  redirect({ href: "/dashboard?notice=joined", locale });
  return fail("unknown");
}

/** Already logged in: one click to join. */
export async function acceptInviteAction(token: string, locale: Locale): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("notLoggedIn");
  return joinAndGo(supabase, token, locale);
}

/** New person: create the account, then join. */
export async function acceptInviteNewAccountAction(input: AcceptInviteInput): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const locale = v.locale as Locale;

  const supabase = await createClient();
  const { data: previewRows } = await supabase.rpc("invitation_preview", { p_token: v.token });
  const invite = previewRows?.[0];
  if (!invite || invite.state !== "valid") return fail("inviteInvalid");

  const metadata = { full_name: v.fullName, phone: v.phone, locale };

  if (invite.email) {
    // The link was sent to this address, which proves the person owns it:
    // create a confirmed account (no second email to click).
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email: invite.email,
      password: v.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists") return fail("accountExists");
      if (error.code === "weak_password") return fail("passwordWeak", { password: "passwordLettersDigits" });
      return fail("unknown");
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: invite.email, password: v.password });
    if (loginError) return fail("unknown");
    return joinAndGo(supabase, v.token, locale);
  }

  // Invitation sent by WhatsApp: the email still has to be confirmed.
  if (!v.email) return fail("invalidForm", { email: "required" });
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: { data: metadata, emailRedirectTo: siteUrl(localizedPath(`/invite/${v.token}`, locale)) },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") return fail("accountExists");
    return fail("unknown");
  }
  if (!data.user || data.user.identities?.length === 0) return fail("accountExists");
  if (data.session) return joinAndGo(supabase, v.token, locale);
  redirect({ href: `/check-email?email=${encodeURIComponent(v.email)}`, locale });
  return fail("unknown");
}
