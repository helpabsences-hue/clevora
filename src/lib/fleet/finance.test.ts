import { describe, expect, it } from "vitest";
import { addMonths, financeSchema, summarize, type Profitability } from "./finance";

const base: Profitability = {
  vehicle_id: "x",
  plate: "1-A-6",
  brand_model: "Dacia Logan",
  status: "active",
  purchase_date: "2025-01-10",
  purchase_price: 150000,
  mode: "credit",
  down_payment: 30000,
  monthly_payment: 3000,
  months: 48,
  first_payment_on: "2025-02-05",
  lender: "Wafasalaf",
  months_paid: 13,
  paid_so_far: 69000,
  credit_left: 105000,
  total_cost: 174000,
  revenue: 120000,
  charges: 20000,
  gain: 100000,
  revenue_month: 9000,
  charges_month: 1200,
  credit_month: 3000,
  damages: 0,
  damages_month: 0,
};

describe("addMonths", () => {
  it("keeps the day and clamps to the end of the month", () => {
    expect(addMonths("2025-02-05", 47)).toBe("2029-01-05");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });
});

describe("summarize", () => {
  it("credit running: months left, end date, payback and whether the car pays its credit", () => {
    const s = summarize(base);
    expect(s.creditRunning).toBe(true);
    expect(s.monthsLeft).toBe(35);
    expect(s.creditEnd).toBe("2029-01-05");
    expect(s.paybackPct).toBe(57);
    expect(s.paidBack).toBe(false);
    expect(s.result).toBe(31000);
    expect(s.monthResult).toBe(4800); // 9 000 rent − 1 200 charges − 3 000 credit
  });

  it("a month that earns less than its credit payment is negative", () => {
    expect(summarize({ ...base, revenue_month: 2000 }).monthResult).toBe(-2200);
    // A damage fee kept this month is income too
    expect(summarize({ ...base, damages_month: 1500 }).monthResult).toBe(6300);
  });

  it("finished credit and cash cars", () => {
    expect(summarize({ ...base, months_paid: 48, credit_left: 0, credit_month: 0 }).monthResult).toBe(7800);
    const cash = summarize({ ...base, mode: "cash", monthly_payment: null, months: null, first_payment_on: null, total_cost: 150000, paid_so_far: 150000, credit_left: 0, gain: 160000 });
    expect(cash.creditRunning).toBe(false);
    expect(cash.paidBack).toBe(true);
    expect(cash.result).toBe(10000);
    expect(cash.creditEnd).toBeNull();
  });
});

describe("financeSchema", () => {
  const ok = { purchase_date: "2025-01-10", purchase_price: 150000, mode: "credit" as const, down_payment: 30000, monthly_payment: 3000, months: 48, first_payment_on: "2025-02-05", lender: "" };
  it("a credit needs the monthly payment, months and first payment", () => {
    const r = financeSchema.safeParse({ ...ok, monthly_payment: null, months: null, first_payment_on: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["first_payment_on", "monthly_payment", "months"]);
  });
  it("cash clears the credit fields", () => {
    const r = financeSchema.parse({ ...ok, mode: "cash" });
    expect(r).toMatchObject({ mode: "cash", down_payment: 0, monthly_payment: null, months: null, first_payment_on: null, lender: null });
  });
});
