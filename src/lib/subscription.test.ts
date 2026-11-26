import { describe, expect, it } from "vitest";
import { computeSubscription } from "./subscription";

const now = new Date("2026-11-09T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

describe("computeSubscription (mirrors public.subscription_is_writable)", () => {
  it("trial: writable with the days left", () => {
    expect(computeSubscription({ status: "trial", trialEndsAt: inDays(14), currentPeriodEnd: null }, now)).toMatchObject({
      writable: true,
      reason: "trial",
      trialDaysLeft: 14,
    });
    expect(computeSubscription({ status: "trial", trialEndsAt: inDays(0.1), currentPeriodEnd: null }, now).trialDaysLeft).toBe(1);
  });
  it("trial over: read-only", () => {
    expect(computeSubscription({ status: "trial", trialEndsAt: inDays(-0.01), currentPeriodEnd: null }, now)).toMatchObject({
      writable: false,
      reason: "trial_ended",
    });
  });
  it("active until the end of the paid period", () => {
    expect(computeSubscription({ status: "active", trialEndsAt: null, currentPeriodEnd: inDays(10) }, now).writable).toBe(true);
    expect(computeSubscription({ status: "active", trialEndsAt: null, currentPeriodEnd: null }, now).writable).toBe(true);
    expect(computeSubscription({ status: "active", trialEndsAt: null, currentPeriodEnd: inDays(-1) }, now)).toMatchObject({
      writable: false,
      reason: "period_ended",
    });
  });
  it("past_due keeps working; suspended and cancelled are read-only", () => {
    expect(computeSubscription({ status: "past_due", trialEndsAt: null, currentPeriodEnd: inDays(-3) }, now).writable).toBe(true);
    expect(computeSubscription({ status: "suspended", trialEndsAt: null, currentPeriodEnd: inDays(30) }, now).writable).toBe(false);
    expect(computeSubscription({ status: "cancelled", trialEndsAt: null, currentPeriodEnd: null }, now).writable).toBe(false);
  });
});
