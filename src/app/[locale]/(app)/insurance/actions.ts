"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext } from "@/lib/auth/action";

const optionalDate = z.union([z.literal(""), z.iso.date({ error: "date" })]).transform((v) => (v === "" ? null : v));
const papersSchema = z.object({
  insurance_expires_on: optionalDate,
  technical_visit_expires_on: optionalDate,
  insurer: z.string().trim().max(120, { error: "nameMax" }).transform((v) => v || null),
  policy_number: z.string().trim().max(80, { error: "nameMax" }).transform((v) => v || null),
});
export type PapersInput = z.input<typeof papersSchema>;

/** Insurance / technical visit dates and the optional insurer (staff too). */
export async function updatePapersAction(vehicleId: string, input: PapersInput): Promise<ActionResult> {
  if (!z.uuid().safeParse(vehicleId).success) return fail("forbidden");
  const parsed = papersSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext();
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase
    .from("vehicles")
    .update(parsed.data)
    .eq("id", vehicleId)
    .eq("agency_id", guard.ctx.agency.id)
    .select("id");
  if (error) return fail(dbErrorKey(error));
  if (!data?.length) return fail("notFound");
  revalidatePath("/[locale]", "layout");
  return ok();
}
