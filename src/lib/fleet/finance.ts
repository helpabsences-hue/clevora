import { z } from "zod";

/** Achat et crédit of a car (admins only). Shared by the form and the server action. */
export const financeSchema = z
  .object({
    purchase_date: z.iso.date({ error: "date" }),
    purchase_price: z.number({ error: "required" }).positive({ error: "number" }).max(100_000_000, { error: "number" }).nullable(),
    mode: z.enum(["cash", "credit"], { error: "required" }),
    down_payment: z.number().min(0, { error: "number" }).max(100_000_000, { error: "number" }).nullable(),
    monthly_payment: z.number().positive({ error: "number" }).max(10_000_000, { error: "number" }).nullable(),
    months: z.number().int({ error: "number" }).min(1, { error: "number" }).max(120, { error: "number" }).nullable(),
    first_payment_on: z.union([z.iso.date({ error: "date" }), z.literal("")]),
    lender: z.string().trim().max(120, { error: "nameMax" }).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.purchase_price === null) ctx.addIssue({ code: "custom", message: "required", path: ["purchase_price"] });
    if (v.mode !== "credit") return;
    if (v.monthly_payment === null) ctx.addIssue({ code: "custom", message: "required", path: ["monthly_payment"] });
    if (v.months === null) ctx.addIssue({ code: "custom", message: "required", path: ["months"] });
    if (!v.first_payment_on) ctx.addIssue({ code: "custom", message: "required", path: ["first_payment_on"] });
  })
  .transform((v) => {
    const credit = v.mode === "credit";
    return {
      purchase_date: v.purchase_date,
      purchase_price: v.purchase_price ?? 0,
      mode: v.mode,
      down_payment: credit ? (v.down_payment ?? 0) : 0,
      monthly_payment: credit ? v.monthly_payment : null,
      months: credit ? v.months : null,
      first_payment_on: credit && v.first_payment_on ? v.first_payment_on : null,
      lender: credit && v.lender ? v.lender : null,
    };
  });
export type FinanceInput = z.input<typeof financeSchema>;

/** One row of public.vehicle_profitability (numbers already converted). */
export type Profitability = {
  vehicle_id: string;
  plate: string;
  brand_model: string;
  status: string;
  purchase_date: string;
  purchase_price: number;
  mode: "cash" | "credit";
  down_payment: number;
  monthly_payment: number | null;
  months: number | null;
  first_payment_on: string | null;
  lender: string | null;
  months_paid: number;
  paid_so_far: number;
  credit_left: number;
  total_cost: number;
  revenue: number;
  charges: number;
  gain: number;
  revenue_month: number;
  charges_month: number;
  credit_month: number;
  /** Damage fees kept at return (income, shown on their own): since purchase / this month. */
  damages: number;
  damages_month: number;
};

/** "2026-03-05" + 3 months => "2026-06-05" (same day, clamped to the month end). */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export type FinanceSummary = {
  /** Credit still running (cash cars and finished credits: false). */
  creditRunning: boolean;
  monthsLeft: number;
  /** Date of the last monthly payment. */
  creditEnd: string | null;
  /** Revenue − charges since purchase, as a share of what the car costs in the end (0–100+). */
  paybackPct: number;
  /** The car has earned back everything it costs. */
  paidBack: boolean;
  /** Since purchase: revenue − charges − what was really paid for the car. */
  result: number;
  /** This month: rent + damage fees − charges − this month's credit payment. */
  monthResult: number;
};

export function summarize(p: Profitability): FinanceSummary {
  const creditRunning = p.mode === "credit" && p.credit_left > 0;
  const monthsLeft = p.mode === "credit" && p.months !== null ? Math.max(0, p.months - p.months_paid) : 0;
  const creditEnd = p.mode === "credit" && p.first_payment_on && p.months ? addMonths(p.first_payment_on, p.months - 1) : null;
  const paybackPct = p.total_cost > 0 ? Math.max(0, Math.round((p.gain / p.total_cost) * 100)) : 0;
  return {
    creditRunning,
    monthsLeft,
    creditEnd,
    paybackPct,
    paidBack: p.gain >= p.total_cost,
    result: p.gain - p.paid_so_far,
    monthResult: p.revenue_month + p.damages_month - p.charges_month - p.credit_month,
  };
}
