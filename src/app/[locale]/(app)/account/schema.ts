import { z } from "zod";
import { localeField, newPasswordField, optionalPhoneField, personNameField } from "@/lib/validation/common";

export const profileSchema = z.object({
  fullName: personNameField,
  phone: optionalPhoneField,
});
export type ProfileInput = z.input<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, { error: "required" }),
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { error: "passwordsDontMatch", path: ["confirm"] });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const preferencesSchema = z.object({
  locale: localeField,
  theme: z.enum(["light", "dark", "system"]),
});
export type PreferencesInput = z.input<typeof preferencesSchema>;
