import { describe, expect, it } from "vitest";
import { settleReturn } from "./damages";

describe("damages at return: kept from the caution, never more than the franchise", () => {
  it("no damage: the whole caution goes back", () => {
    expect(settleReturn({ due: 0, deposit: 3000, fee: 0, franchise: 5000 })).toEqual({ fee: 0, kept: 0, refund: 3000, toPay: 0 });
  });
  it("the caution covers the damage: the rest of the caution goes back", () => {
    expect(settleReturn({ due: 200, deposit: 3000, fee: 1200, franchise: 5000 })).toEqual({ fee: 1200, kept: 1200, refund: 1800, toPay: 200 });
  });
  it("the damage is more than the caution: the client owes the difference", () => {
    expect(settleReturn({ due: 0, deposit: 2000, fee: 3500, franchise: 5000 })).toEqual({ fee: 3500, kept: 2000, refund: 0, toPay: 1500 });
  });
  it("never more than the franchise", () => {
    expect(settleReturn({ due: 0, deposit: 10000, fee: 8000, franchise: 5000 })).toEqual({ fee: 5000, kept: 5000, refund: 5000, toPay: 0 });
  });
  it("no caution taken: everything is to pay", () => {
    expect(settleReturn({ due: 300, deposit: 0, fee: 1000, franchise: 5000 })).toEqual({ fee: 1000, kept: 0, refund: 0, toPay: 1300 });
  });
});
