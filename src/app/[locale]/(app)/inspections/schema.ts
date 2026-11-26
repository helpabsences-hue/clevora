import { z } from "zod";
import { DAMAGE_TYPES, VIEWS } from "@/lib/inspections/model";

export const KINDS = ["departure", "return"] as const;
export type Kind = (typeof KINDS)[number];

export const damageSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  type: z.enum(DAMAGE_TYPES, { error: "required" }),
  view: z.enum(VIEWS).nullable(),
  note: z.string().trim().max(300, { error: "tooLong" }).default(""),
});
export type DamageInput = z.input<typeof damageSchema>;
