"use server";

import { clientIp, rateLimitAll } from "@/lib/rate-limit";
import { getLocale } from "next-intl/server";
import { localizedPath } from "@/i18n/routing";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { redirectAfterLogin } from "@/lib/auth/after-login";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import {
  emailOnlySchema,
  loginSchema,
  newPasswordSchema,
  type EmailOnlyInput,
  type LoginInput,
  type NewPasswordInput,
} from "./schema";

function authErrorKey(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "tooManyRequests";
    case "weak_password":
      return "passwordWeak";
    case "same_password":
      return "samePassword";
    default:
      return "unknown";
  }
}

export async function loginAction(input: LoginInput, next?: string | null): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));

  if (!(await rateLimitAll([["loginIp", await clientIp()], ["loginEmail", parsed.data.email]]))) return fail("tooManyRequests");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return fail(authErrorKey(error ?? {}));

  // Two-step login turned on: the 6-digit code comes before anything else.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const locale = await getLocale();
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    redirect({ href: safe ? `/mfa?next=${encodeURIComponent(safe)}` : "/mfa", locale });
  }

  return redirectAfterLogin(supabase, data.user.id, next);
}

/** Magic link. Always answers "sent" so nobody can test which emails exist. */
export async function magicLinkAction(input: EmailOnlyInput): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (!(await rateLimitAll([["emailLinkIp", await clientIp()], ["emailLinkEmail", parsed.data.email]]))) return fail("tooManyRequests");
  const supabase = await createClient();
  const locale = await getLocale();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: siteUrl(localizedPath("/dashboard", locale)) },
  });
  if (error && authErrorKey(error) === "tooManyRequests") return fail("tooManyRequests");
  return ok();
}

/** Password reset email. Always answers "sent" (no account enumeration). */
export async function forgotPasswordAction(input: EmailOnlyInput): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  if (!(await rateLimitAll([["emailLinkIp", await clientIp()], ["emailLinkEmail", parsed.data.email]]))) return fail("tooManyRequests");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: siteUrl("/reset-password"),
  });
  if (error && authErrorKey(error) === "tooManyRequests") return fail("tooManyRequests");
  return ok();
}

/** New password after clicking the reset link (the link opened a session). */
export async function resetPasswordAction(input: NewPasswordInput): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("linkExpired");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authErrorKey(error));
  const locale = await getLocale();
  redirect({ href: "/dashboard?notice=passwordUpdated", locale });
  return ok();
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/login", locale });
}
