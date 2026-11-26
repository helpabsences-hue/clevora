"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { redirectAfterLogin } from "@/lib/auth/after-login";
import { clientIp, rateLimitAll } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const codeSchema = z.string().regex(/^\d{6}$/);

async function verifiedFactor() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return { supabase, factor: data?.totp.find((f) => f.status === "verified") ?? null };
}

/** Start turning on two-step login: QR code + secret to type into the app. */
export async function enrollMfaAction(): Promise<ActionResult<{ factorId: string; qrCode: string; secret: string }>> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return fail("notLoggedIn");
  // Remove an earlier unfinished attempt so a new QR code can be made.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Parcolia ${new Date().toISOString().slice(0, 10)}`, issuer: "Parcolia" });
  if (error || !data) return fail("unknown");
  return ok({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
}

/** Finish turning it on: the first code from the app proves it works. */
export async function confirmMfaAction(factorId: string, code: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(factorId).success || !codeSchema.safeParse(code).success) return fail("invalidForm", { code: "mfaCode" });
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return fail("invalidForm", { code: "mfaWrong" });
  return ok();
}

/** Turn it off (the session is already AAL2, so the code was entered). */
export async function disableMfaAction(): Promise<ActionResult> {
  const { supabase, factor } = await verifiedFactor();
  if (!factor) return ok();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) return fail("mfaReauth");
  return ok();
}

/** Login step 2: the 6-digit code. */
export async function verifyLoginCodeAction(code: string, next?: string | null): Promise<ActionResult> {
  if (!codeSchema.safeParse(code).success) return fail("invalidForm", { code: "mfaCode" });
  const { supabase, factor } = await verifiedFactor();
  if (!factor) return ok();
  const { data: user } = await supabase.auth.getUser();
  if (!(await rateLimitAll([["loginIp", await clientIp()], ["loginEmail", user.user?.email ?? factor.id]]))) return fail("tooManyRequests");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return fail("invalidForm", { code: "mfaWrong" });
  // Now AAL2: the agencies are open again; continue like a normal login.
  return redirectAfterLogin(supabase, user.user!.id, next);
}
