import { z } from "zod";
import { optionalPhoneField, phoneField } from "@/lib/validation/common";

// zod messages are keys of the "validation" namespace.
const optionalText = z.string().trim().max(200, { error: "nameMax" }).optional().default("");
const optionalDate = z.union([z.literal(""), z.iso.date({ error: "date" })]).optional().default("");

export const ID_TYPES = ["cin", "passport"] as const;
export const PAYMENT_METHODS = ["cash", "card", "transfer", "cheque"] as const;

export const driverSchema = z.object({
  id_type: z.enum(ID_TYPES, { error: "required" }),
  id_number: z.string().trim().min(3, { error: "idNumberMin" }).max(40, { error: "nameMax" }),
  full_name: z.string().trim().min(2, { error: "nameMin" }).max(160, { error: "nameMax" }),
  // stored as +212612345678 whatever the format typed
  phone: optionalPhoneField.optional().transform((v) => v ?? ""),
  nationality: optionalText,
  address: optionalText,
  birth_date: optionalDate,
  birth_place: optionalText,
  id_expires_on: optionalDate,
  license_number: optionalText,
  license_issued_on: optionalDate,
  license_issued_place: optionalText,
});
export type DriverInput = z.input<typeof driverSchema>;

export const EMPTY_DRIVER: DriverInput & { phone: string } = {
  id_type: "cin",
  id_number: "",
  full_name: "",
  phone: "",
  nationality: "Marocaine",
  address: "",
  birth_date: "",
  birth_place: "",
  id_expires_on: "",
  license_number: "",
  license_issued_on: "",
  license_issued_place: "",
};

const money = z.number({ error: "required" }).min(0, { error: "number" }).max(10_000_000, { error: "number" });

export const reservationSchema = z
  .object({
    contract_number: z.string().trim().max(40, { error: "nameMax" }).default(""),
    start_date: z.iso.date({ error: "date" }),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, { error: "time" }),
    end_date: z.iso.date({ error: "date" }),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, { error: "time" }),
    // Empty with car_later = the car is chosen on the contract, before the departure.
    vehicle_id: z.union([z.uuid({ error: "chooseCar" }), z.literal("")]).default(""),
    car_later: z.boolean().default(false),
    driver1: driverSchema.extend({ phone: phoneField }),
    has_driver2: z.boolean(),
    driver2: driverSchema.optional(),
    daily_price: money,
    delivery: z.boolean(),
    delivery_place: optionalText,
    return_place: optionalText,
    delivery_fee: money,
    advance_amount: money,
    advance_method: z.enum(PAYMENT_METHODS),
    franchise: money,
    deposit_taken: z.boolean(),
    deposit_amount: money,
    deposit_method: z.enum(PAYMENT_METHODS),
    km_out: z.number().int().min(0).nullable(),
    fuel_out: z.number().int().min(0).max(4).nullable(),
    equipment: z.array(z.string().max(80)).max(50),
    documents_given: z.array(z.string().max(80)).max(50),
    notes: z.string().trim().max(1000).default(""),
  })
  .refine((v) => `${v.end_date}T${v.end_time}` > `${v.start_date}T${v.start_time}`, { error: "endBeforeStart", path: ["end_date"] })
  .refine((v) => !v.has_driver2 || v.driver2 !== undefined, { error: "required", path: ["driver2", "id_number"] })
  .refine((v) => !v.delivery || v.delivery_place.length > 0, { error: "required", path: ["delivery_place"] })
  .refine((v) => v.car_later || v.vehicle_id !== "", { error: "chooseCar", path: ["vehicle_id"] });
export type ReservationInput = z.input<typeof reservationSchema>;

export const extendSchema = z.object({
  end_date: z.iso.date({ error: "date" }),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, { error: "time" }),
});

export const cancelSchema = z.object({ reason: z.string().trim().min(3, { error: "required" }).max(300, { error: "nameMax" }) });

export const returnSchema = z.object({
  return_date: z.iso.date({ error: "date" }),
  return_time: z.string().regex(/^\d{2}:\d{2}$/, { error: "time" }),
  km_in: z.number({ error: "required" }).int().min(0),
  fuel_in: z.number({ error: "required" }).int().min(0).max(4),
  balance_amount: money,
  balance_method: z.enum(PAYMENT_METHODS),
  refund_deposit: z.boolean(),
  refund_amount: money,
  refund_method: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(1000).default(""),
  /** Damages found at return: kept from the caution, never more than the franchise (checked by the database). */
  damage_amount: money.default(0),
  damage_note: z.string().trim().max(500).default(""),
});
export type ReturnInput = z.input<typeof returnSchema>;

export const paymentSchema = z.object({
  amount: z.number({ error: "required" }).positive({ error: "number" }),
  method: z.enum(PAYMENT_METHODS),
  kind: z.enum(["advance", "balance", "deposit", "deposit_refund", "extra"]),
  note: z.string().trim().max(200).default(""),
});
export type PaymentInput = z.input<typeof paymentSchema>;
