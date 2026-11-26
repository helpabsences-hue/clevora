"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbErrorKey } from "@/lib/auth/action";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { casablancaToIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/[locale]/platform", "layout");
}

/** Parcolia received the money: invoice, plan switched, period extended (SQL function checks the role). */
export async function confirmPaymentAction(id: string): Promise<ActionResult<{ invoice: string }>> {
  if (!z.uuid().safeParse(id).success || !(await isPlatformAdmin())) return fail("forbidden");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_subscription_payment", { p_payment: id });
  if (error || !data) return fail(dbErrorKey(error));
  refresh();
  return ok({ invoice: data });
}

export async function cancelPaymentAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success || !(await isPlatformAdmin())) return fail("forbidden");
  const supabase = await createClient();
  const { error } = await supabase.from("subscription_payments").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
  if (error) return fail(dbErrorKey(error));
  refresh();
  return ok();
}

const agencySchema = z.object({
  id: z.uuid(),
  plan: z.enum(["essentiel", "pro", "illimite"]),
  status: z.enum(["trial", "active", "past_due", "suspended", "cancelled"]),
  trial_ends_on: z.union([z.iso.date(), z.literal("")]),
  period_ends_on: z.union([z.iso.date(), z.literal("")]),
});

/** Change an agency's plan, status and dates by hand (support, gestures, suspensions). */
export async function updateAgencyAction(input: z.input<typeof agencySchema>): Promise<ActionResult> {
  const parsed = agencySchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm");
  if (!(await isPlatformAdmin())) return fail("forbidden");
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("id").eq("code", parsed.data.plan).single();
  if (!plan) return fail("invalidForm");
  const { error, count } = await supabase
    .from("agencies")
    .update(
      {
        plan_id: plan.id,
        subscription_status: parsed.data.status,
        trial_ends_at: parsed.data.trial_ends_on ? casablancaToIso(parsed.data.trial_ends_on, "23:59") : null,
        current_period_end: parsed.data.period_ends_on ? casablancaToIso(parsed.data.period_ends_on, "23:59") : null,
      },
      { count: "exact" },
    )
    .eq("id", parsed.data.id);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("forbidden");
  refresh();
  return ok();
}

/** Quick gestures on an agency: extend its trial, suspend it, or reactivate it. */
export async function agencyQuickAction(id: string, action: "extend_trial" | "suspend" | "reactivate"): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success || !["extend_trial", "suspend", "reactivate"].includes(action)) return fail("invalidForm");
  if (!(await isPlatformAdmin())) return fail("forbidden");
  const supabase = await createClient();
  const { data: a } = await supabase.from("agencies").select("trial_ends_at, current_period_end").eq("id", id).maybeSingle();
  if (!a) return fail("notFound");
  const now = Date.now();
  const in14 = new Date(now + 14 * 86_400_000).toISOString();
  let patch: { subscription_status?: string; trial_ends_at?: string };
  if (action === "extend_trial") {
    const from = Math.max(now, a.trial_ends_at ? new Date(a.trial_ends_at).getTime() : now);
    patch = { subscription_status: "trial", trial_ends_at: new Date(from + 14 * 86_400_000).toISOString() };
  } else if (action === "suspend") {
    patch = { subscription_status: "suspended" };
  } else {
    // Back to "active" while a paid period runs, otherwise a fresh 14-day trial.
    const paid = a.current_period_end && new Date(a.current_period_end).getTime() > now;
    patch = paid ? { subscription_status: "active" } : { subscription_status: "trial", trial_ends_at: in14 };
  }
  const { error, count } = await supabase.from("agencies").update(patch, { count: "exact" }).eq("id", id);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("forbidden");
  refresh();
  return ok();
}

/** Give or remove Parcolia admin access (the SQL function protects self and last admin). */
export async function setPlatformAdminAction(email: string, on: boolean): Promise<ActionResult> {
  const parsed = z.email().safeParse(String(email ?? "").trim());
  if (!parsed.success) return fail("invalidForm", { email: "email" });
  if (!(await isPlatformAdmin())) return fail("forbidden");
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_admin", { p_email: parsed.data, p_on: on });
  if (error) {
    if (error.hint === "no_account") return fail("invalidForm", { email: "noAccount" });
    if (error.hint === "self_change") return fail("selfChange");
    if (error.hint === "last_platform_admin") return fail("lastPlatformAdmin");
    return fail(dbErrorKey(error));
  }
  refresh();
  return ok();
}

const planSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2, { error: "nameMin" }).max(60, { error: "nameMax" }),
  price_mad_month: z.number({ error: "required" }).min(0, { error: "number" }).max(1_000_000),
  price_mad_year: z.number({ error: "required" }).min(0, { error: "number" }).max(10_000_000),
  max_vehicles: z.number().int().positive({ error: "number" }).nullable(),
  max_users: z.number().int().positive({ error: "number" }).nullable(),
  ai_enabled: z.boolean(),
  ai_monthly_questions: z.number().int().positive({ error: "number" }).nullable(),
  active: z.boolean(),
});
export type PlanInput = z.input<typeof planSchema>;

/** Edit a plan: price, limits, AI, shown or hidden. Existing agencies keep their plan. */
export async function savePlanAction(input: PlanInput): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  if (!(await isPlatformAdmin())) return fail("forbidden");
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error, count } = await supabase.from("plans").update(values, { count: "exact" }).eq("id", id);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("forbidden");
  revalidatePath("/[locale]", "layout");
  return ok();
}
