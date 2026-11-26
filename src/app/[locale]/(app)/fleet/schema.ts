import { z } from "zod";

// zod messages are keys of the "validation" namespace.
const optionalDate = z.union([z.literal(""), z.iso.date({ error: "date" })]).transform((v) => (v === "" ? null : v));
const optionalKm = z
  .union([z.literal(""), z.coerce.number({ error: "number" }).int({ error: "number" }).min(0, { error: "number" })])
  .transform((v) => (v === "" ? null : v));

export const CATEGORIES = ["economy", "compact", "suv", "van", "luxury"] as const;
export const FUELS = ["essence", "diesel", "hybride", "electrique"] as const;
export const GEARBOXES = ["manuelle", "automatique"] as const;
export const MAINTENANCE_REASONS = ["panne", "accident", "carrosserie", "pneus", "entretien", "autre"] as const;

/** Add / edit a car. No insurer or policy number here (Assurance page). */
export const vehicleSchema = z
  .object({
    plate: z.string().trim().min(2, { error: "required" }).max(20, { error: "nameMax" }),
    brand_model: z.string().trim().min(1, { error: "required" }).max(120, { error: "nameMax" }),
    category: z.enum(CATEGORIES, { error: "required" }),
    fuel: z.enum(FUELS, { error: "required" }),
    gearbox: z.enum(GEARBOXES, { error: "required" }),
    daily_rate: z.number({ error: "required" }).min(0, { error: "number" }).max(1_000_000, { error: "number" }),
    current_km: z.coerce.number({ error: "number" }).int({ error: "number" }).min(0, { error: "number" }),
    first_registration_date: optionalDate,
    insurance_expires_on: optionalDate,
    technical_visit_expires_on: optionalDate,
    oil_last_km: optionalKm,
    oil_last_date: optionalDate,
    oil_next_km: optionalKm,
  })
  .refine((v) => v.oil_next_km === null || v.oil_last_km === null || v.oil_next_km > v.oil_last_km, {
    error: "oilNextAfterLast",
    path: ["oil_next_km"],
  });
export type VehicleInput = z.input<typeof vehicleSchema>;

export const maintenanceSchema = z
  .object({
    vehicleId: z.uuid(),
    reason: z.enum(MAINTENANCE_REASONS, { error: "required" }),
    starts_on: z.iso.date({ error: "date" }),
    expected_end_on: optionalDate,
    note: z.string().trim().max(500, { error: "nameMax" }).optional().default(""),
  })
  .refine((v) => v.expected_end_on === null || v.expected_end_on >= v.starts_on, {
    error: "endBeforeStart",
    path: ["expected_end_on"],
  });
export type MaintenanceInput = z.input<typeof maintenanceSchema>;
