import { z } from "zod";
import { brandColorField, optionalPhoneField } from "@/lib/validation/common";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((v) => v || null);

export const agencySettingsSchema = z.object({
  name: z.string().trim().min(2, "agencyNameMin").max(120, "nameMax"),
  address: optionalText(200),
  city: optionalText(80),
  phone: optionalPhoneField,
  email: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.email("email").nullable()),
  brand_color: brandColorField,
});

export const legalSettingsSchema = z.object({
  rc: optionalText(40),
  ice: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, "") || null)
    .pipe(z.string().regex(/^\d{15}$/, "ice").nullable()),
  if_number: optionalText(40),
  patente: optionalText(40),
  cnss: optionalText(40),
});

const listItems = z.array(z.string().trim().min(1, "required").max(40, "tooLong")).max(30, "tooMany");

export const contractSettingsSchema = z.object({
  contract_terms: optionalText(8000),
  contract_number_prefix: z.string().trim().max(20, "tooLong"),
  min_driver_age: z.number({ error: "number" }).int("number").min(18, "minAge").max(99, "number"),
  min_license_years: z.number({ error: "number" }).int("number").min(0, "number").max(50, "number"),
  default_franchise: z.number({ error: "number" }).min(0, "number").max(1_000_000, "number"),
  default_deposit: z.number({ error: "number" }).min(0, "number").max(1_000_000, "number"),
  equipment_items: listItems,
  document_items: listItems,
});

export const alertSettingsSchema = z.object({
  alert_days_before: z.number({ error: "number" }).int("number").min(1, "number").max(365, "number"),
  alert_km_before: z.number({ error: "number" }).int("number").min(100, "number").max(50000, "number"),
  alert_roles: z.array(z.enum(["admin", "staff"])).min(1, "required"),
});

export const assistantSettingsSchema = z.object({ ai_enabled: z.boolean() });

export const inspectionSettingsSchema = z.object({
  inspection_enabled: z.boolean(),
  inspection_mode: z.enum(["photos", "video"]),
});

export const SETTINGS_SCHEMAS = {
  agency: agencySettingsSchema,
  legal: legalSettingsSchema,
  contract: contractSettingsSchema,
  alerts: alertSettingsSchema,
  assistant: assistantSettingsSchema,
  inspection: inspectionSettingsSchema,
} as const;

export type SettingsSection = keyof typeof SETTINGS_SCHEMAS;
export type SettingsInput<S extends SettingsSection> = z.input<(typeof SETTINGS_SCHEMAS)[S]>;
