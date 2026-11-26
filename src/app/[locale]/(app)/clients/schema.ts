import { z } from "zod";
import { driverSchema, EMPTY_DRIVER } from "../reservations/schema";

/** A client card: the same fields as a driver in a reservation, plus e-mail and notes. */
export const clientSchema = driverSchema.extend({
  email: z.union([z.literal(""), z.email({ error: "email" })]).optional().default(""),
  notes: z.string().trim().max(1000, { error: "tooLong" }).optional().default(""),
});
export type ClientInput = z.input<typeof clientSchema>;

export const EMPTY_CLIENT: ClientInput = { ...EMPTY_DRIVER, email: "", notes: "" };
