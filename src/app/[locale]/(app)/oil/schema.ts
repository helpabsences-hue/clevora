import { z } from "zod";

/** What can be changed at a vidange (same list as the oil_changes.items check). */
export const OIL_ITEMS = [
  "huile",
  "filtre_huile",
  "filtre_air",
  "filtre_carburant",
  "filtre_habitacle",
  "courroie",
  "bougies",
  "plaquettes",
  "liquide_refroidissement",
  "autre",
] as const;
export type OilItem = (typeof OIL_ITEMS)[number];

const km = z.number({ error: "required" }).int({ error: "number" }).min(0, { error: "number" }).max(5_000_000, { error: "number" });
export const kmSchema = km;

export const oilSchema = z
  .object({
    date: z.iso.date({ error: "date" }),
    km,
    next_km: km,
    /** At least one thing changed; a price per item becomes a Charge (admins). */
    items: z
      .array(z.object({ item: z.enum(OIL_ITEMS), price: z.number().min(0).max(1_000_000).nullable() }))
      .min(1, { error: "oilItems" })
      .max(OIL_ITEMS.length)
      .refine((list) => new Set(list.map((x) => x.item)).size === list.length, { error: "oilItems" }),
    note: z.string().trim().max(300, { error: "tooLong" }).default(""),
  })
  .refine((v) => v.next_km > v.km, { error: "oilNextAfterLast", path: ["next_km"] })
  .refine((v) => !v.items.some((x) => x.item === "autre") || v.note.length > 0, { error: "required", path: ["note"] });
export type OilChangeInput = z.input<typeof oilSchema>;
