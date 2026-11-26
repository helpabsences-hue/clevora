import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { splitVat } = await import("./provider");

describe("splitVat", () => {
  it("splits an all-taxes-included price into HT + 20 % VAT", () => {
    expect(splitVat(599)).toEqual({ ht: 499.17, vat: 99.83, ttc: 599 });
    expect(splitVat(0)).toEqual({ ht: 0, vat: 0, ttc: 0 });
    const r = splitVat(9990);
    expect(r.ht + r.vat).toBeCloseTo(9990, 2);
  });
});
