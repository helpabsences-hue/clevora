"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  preferencesSchema,
  profileSchema,
  type ChangePasswordInput,
  type PreferencesInput,
  type ProfileInput,
} from "./schema";

// Account settings concern the user, not the agency: they work in read-only mode too.

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const user = await getUser();
  if (!user) return fail("notLoggedIn");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", user.id);
  if (error) return fail("unknown");
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName, phone: parsed.data.phone } });
  revalidatePath("/", "layout");
  return ok();
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const user = await getUser();
  if (!user?.email) return fail("notLoggedIn");
  const supabase = await createClient();
  // Ask for the current password before changing it.
  const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (checkError) return fail("invalidForm", { current: "currentPasswordWrong" });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("invalidForm", { password: "samePassword" });
    if (error.code === "weak_password") return fail("invalidForm", { password: "passwordLettersDigits" });
    return fail("unknown");
  }
  return ok();
}

export async function updatePreferencesAction(input: PreferencesInput): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const user = await getUser();
  if (!user) return fail("notLoggedIn");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_locale: parsed.data.locale, preferred_theme: parsed.data.theme })
    .eq("id", user.id);
  if (error) return fail("unknown");
  // Emails sent by Supabase Auth use this to pick the language.
  await supabase.auth.updateUser({ data: { locale: parsed.data.locale } });

  const current = await getLocale();
  if (parsed.data.locale !== current) {
    redirect({ href: "/account?notice=saved", locale: parsed.data.locale });
  }
  revalidatePath("/", "layout");
  return ok();
}

/** Theme from the header switch: saved in the profile so every device follows. */
export async function updateThemeAction(theme: "light" | "dark" | "system"): Promise<ActionResult> {
  if (!["light", "dark", "system"].includes(theme)) return fail("invalidForm");
  const user = await getUser();
  if (!user) return fail("notLoggedIn");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ preferred_theme: theme }).eq("id", user.id);
  if (error) return fail("unknown");
  return ok();
}

/** Language from the header switch: saved in the profile (emails, next login). */
export async function updateLocaleAction(locale: "fr" | "ar" | "en"): Promise<ActionResult> {
  if (!["fr", "ar", "en"].includes(locale)) return fail("invalidForm");
  const user = await getUser();
  if (!user) return ok(); // before login: the address alone carries the language
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", user.id);
  if (error) return fail("unknown");
  await supabase.auth.updateUser({ data: { locale } });
  return ok();
}
