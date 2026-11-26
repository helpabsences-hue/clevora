import { z } from "zod";
import { isHexColor } from "@/lib/brand";
import { normalizePhone } from "@/lib/phone";

// zod messages are keys of the "validation" translation namespace.

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "required" })
  .pipe(z.email({ error: "email" }));

/** Same rule as Supabase Auth: at least 8 characters with letters and digits. */
export const newPasswordField = z
  .string()
  .min(8, { error: "passwordMin" })
  .max(72, { error: "passwordMax" })
  .regex(/[A-Za-z]/, { error: "passwordLettersDigits" })
  .regex(/\d/, { error: "passwordLettersDigits" });

export const passwordField = z.string().min(1, { error: "required" });

export const personNameField = z
  .string()
  .trim()
  .min(2, { error: "nameMin" })
  .max(120, { error: "nameMax" });

/** Phone typed by a user → E.164 (+212612345678). */
export const phoneField = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return normalized;
  });

export const optionalPhoneField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return normalized;
  });

export const brandColorField = z.string().refine(isHexColor, { error: "color" });

export const localeField = z.enum(["fr", "ar", "en"]);
