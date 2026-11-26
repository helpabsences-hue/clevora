"use server";

import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { localizedPath, type Locale } from "@/i18n/routing";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { ACTIVE_AGENCY_COOKIE, ACTIVE_AGENCY_COOKIE_OPTIONS, getUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { slugify, withSuffix } from "@/lib/slug";
import { LOGO_MAX_BYTES, LOGO_TYPES, type LogoType } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signupAgencyOnlySchema, signupSchema } from "../schema";

type AgencyFields = { agencyName: string; city: string; agencyPhone: string; brandColor: string };
type RpcClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    fullName: get("fullName"),
    email: get("email"),
    phone: get("phone"),
    password: get("password"),
    agencyName: get("agencyName"),
    city: get("city"),
    agencyPhone: get("agencyPhone"),
    brandColor: get("brandColor"),
    locale: get("locale"),
  };
}

function readLogo(formData: FormData): { file: File | null; error?: string } {
  const value = formData.get("logo");
  if (!(value instanceof File) || value.size === 0) return { file: null };
  if (!(value.type in LOGO_TYPES)) return { file: null, error: "logoType" };
  if (value.size > LOGO_MAX_BYTES) return { file: null, error: "logoSize" };
  return { file: value };
}

/** Creates the agency, retrying with a suffix when the generated slug is taken. */
async function createAgency(
  client: RpcClient,
  fields: AgencyFields,
  userId: string | null,
): Promise<{ id: string } | { error: string }> {
  const base = slugify(fields.agencyName);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : withSuffix(base);
    const args = {
      p_name: fields.agencyName,
      p_slug: slug,
      p_city: fields.city,
      p_phone: fields.agencyPhone,
      p_brand_color: fields.brandColor,
    };
    const { data, error } = userId
      ? await client.rpc("create_agency_for_user", { ...args, p_user: userId })
      : await client.rpc("create_agency", args);
    if (!error && data) return { id: data };
    if (error?.code !== "23505") return { error: "unknown" };
  }
  return { error: "unknown" };
}

async function uploadLogo(client: RpcClient, agencyId: string, file: File): Promise<void> {
  const ext = LOGO_TYPES[file.type as LogoType];
  const path = `${agencyId}/logo-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("agency-logos").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (!error) await client.from("agencies").update({ logo_path: path }).eq("id", agencyId);
}

export async function signupAction(formData: FormData): Promise<ActionResult> {
  const raw = readForm(formData);
  const logo = readLogo(formData);
  const existingUser = await getUser();
  if (!(await rateLimit("signupIp", await clientIp()))) return fail("tooManyRequests");

  // ---------------------------------------------------------------------
  // A logged-in user creating (another) agency: no account step
  // ---------------------------------------------------------------------
  if (existingUser) {
    const parsed = signupAgencyOnlySchema.safeParse(raw);
    if (!parsed.success || logo.error) {
      return fail("invalidForm", { ...(parsed.success ? {} : zodFieldErrors(parsed.error.issues)), ...(logo.error ? { logo: logo.error } : {}) });
    }
    const supabase = await createClient();
    const created = await createAgency(supabase, parsed.data, null);
    if ("error" in created) return fail(created.error);
    if (logo.file) await uploadLogo(supabase, created.id, logo.file);
    (await cookies()).set(ACTIVE_AGENCY_COOKIE, created.id, ACTIVE_AGENCY_COOKIE_OPTIONS);
    redirect({ href: "/dashboard?notice=agencyCreated", locale: parsed.data.locale });
  }

  // ---------------------------------------------------------------------
  // New owner: account + agency
  // ---------------------------------------------------------------------
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success || logo.error) {
    return fail("invalidForm", { ...(parsed.success ? {} : zodFieldErrors(parsed.error.issues)), ...(logo.error ? { logo: logo.error } : {}) });
  }
  const v = parsed.data;
  const locale = v.locale as Locale;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      data: { full_name: v.fullName, phone: v.phone, locale },
      emailRedirectTo: siteUrl(localizedPath("/dashboard", locale)),
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") return fail("emailTaken", { email: "emailTaken" });
    if (error.code === "weak_password") return fail("passwordWeak", { password: "passwordLettersDigits" });
    if (error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") return fail("tooManyRequests");
    return fail("unknown");
  }
  // With email confirmation on, an existing email comes back as a user without identities.
  if (!data.user || data.user.identities?.length === 0) return fail("emailTaken", { email: "emailTaken" });

  if (data.session) {
    // Confirmation off (local dev): we are logged in, create as the user.
    const created = await createAgency(supabase, v, null);
    if ("error" in created) return fail(created.error);
    if (logo.file) await uploadLogo(supabase, created.id, logo.file);
    (await cookies()).set(ACTIVE_AGENCY_COOKIE, created.id, ACTIVE_AGENCY_COOKIE_OPTIONS);
    redirect({ href: "/dashboard?notice=agencyCreated", locale });
  }

  // Confirmation on (production): create the agency now with the server key,
  // the user lands in it right after confirming the email.
  const admin = createAdminClient();
  const created = await createAgency(admin, v, data.user.id);
  if ("error" in created) return fail(created.error);
  if (logo.file) await uploadLogo(admin, created.id, logo.file);
  redirect({ href: `/check-email?email=${encodeURIComponent(v.email)}`, locale });
  return fail("unknown");
}
