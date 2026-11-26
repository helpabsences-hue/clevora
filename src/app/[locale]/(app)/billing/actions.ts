"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";

const requestSchema = z.object({
  plan: z.enum(["essentiel", "pro", "illimite"]),
  period: z.enum(["month", "year"]),
  method: z.enum(["virement", "especes", "cheque"]),
});

/**
 * An admin chooses a plan: creates a pending payment with a reference.
 * Allowed in read-only mode, so an expired agency can always pay.
 */
export async function requestPlanAction(input: z.input<typeof requestSchema>): Promise<ActionResult<{ reference: string; amount: number }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm");
  const guard = await requireActionContext({ roles: ["admin"], write: false });
  if (!guard.ok) return guard;
  const { supabase, agency, user } = guard.ctx;
  const { data, error } = await supabase.rpc("request_subscription", {
    p_agency: agency.id,
    p_plan_code: parsed.data.plan,
    p_period: parsed.data.period,
    p_method: parsed.data.method,
  });
  const row = data?.[0];
  if (error || !row) return fail(dbErrorKey(error));
  await supabase.from("activity_log").insert({ agency_id: agency.id, actor_id: user.id, action: "billing.request", entity: "subscription_payments", entity_id: row.id, details: parsed.data });
  revalidatePath("/[locale]/billing", "page");
  return ok({ reference: row.reference, amount: Number(row.amount) });
}
