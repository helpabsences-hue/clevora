import { z } from "zod";
import {
  brandColorField,
  emailField,
  localeField,
  newPasswordField,
  passwordField,
  personNameField,
  phoneField,
} from "@/lib/validation/common";

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});
export type LoginInput = z.input<typeof loginSchema>;

export const emailOnlySchema = z.object({ email: emailField });
export type EmailOnlyInput = z.input<typeof emailOnlySchema>;

export const newPasswordSchema = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "passwordsDontMatch", path: ["confirm"] });
export type NewPasswordInput = z.input<typeof newPasswordSchema>;

// --- Signup (3 steps) ------------------------------------------------------
export const signupAccountSchema = z.object({
  fullName: personNameField,
  email: emailField,
  phone: phoneField,
  password: newPasswordField,
});

export const signupAgencySchema = z.object({
  agencyName: z.string().trim().min(2, { error: "agencyNameMin" }).max(120, { error: "nameMax" }),
  city: z.string().trim().min(2, { error: "required" }).max(80, { error: "nameMax" }),
  agencyPhone: phoneField,
});

export const signupBrandSchema = z.object({
  brandColor: brandColorField,
});

export const signupSchema = signupAccountSchema.extend(signupAgencySchema.shape).extend(signupBrandSchema.shape).extend({
  locale: localeField,
});
/** Logged-in user creating another agency: no account step. */
export const signupAgencyOnlySchema = signupAgencySchema.extend(signupBrandSchema.shape).extend({ locale: localeField });

export type SignupValues = z.input<typeof signupSchema>;

// --- Accept invitation (new account) ---------------------------------------
export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  fullName: personNameField,
  phone: phoneField,
  email: emailField.optional(),
  password: newPasswordField,
  locale: localeField,
});
export type AcceptInviteInput = z.input<typeof acceptInviteSchema>;
