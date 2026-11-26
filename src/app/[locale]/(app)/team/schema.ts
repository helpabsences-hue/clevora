import { z } from "zod";
import { emailField, phoneField } from "@/lib/validation/common";

export const roleField = z.enum(["admin", "staff"]);

export const inviteSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), email: emailField, role: roleField }),
  z.object({ channel: z.literal("whatsapp"), phone: phoneField, role: roleField }),
]);
export type InviteInput = z.input<typeof inviteSchema>;

export const idField = z.uuid();
