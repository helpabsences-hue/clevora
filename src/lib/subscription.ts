/**
 * Read-only mode. Mirrors public.subscription_is_writable() in the database
 * (the database is the real guard; this only drives the UI).
 */
export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";

export type SubscriptionInput = {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export type SubscriptionState = {
  status: SubscriptionStatus;
  writable: boolean;
  /** Why the agency is (or is not) read-only — drives the banner text. */
  reason: "trial" | "trial_ended" | "active" | "period_ended" | "past_due" | "suspended" | "cancelled";
  /** Days left in the trial (1 on the last day, 0 once ended), null outside a trial. */
  trialDaysLeft: number | null;
};

const DAY = 24 * 60 * 60 * 1000;

export function computeSubscription(input: SubscriptionInput, now: Date = new Date()): SubscriptionState {
  const t = now.getTime();
  switch (input.status) {
    case "trial": {
      const end = input.trialEndsAt ? new Date(input.trialEndsAt).getTime() : null;
      if (end !== null && end <= t) {
        return { status: "trial", writable: false, reason: "trial_ended", trialDaysLeft: 0 };
      }
      // 14 days after signup => 14; the last few hours => 1
      const daysLeft = end === null ? null : Math.max(1, Math.ceil((end - t) / DAY));
      return { status: "trial", writable: true, reason: "trial", trialDaysLeft: daysLeft };
    }
    case "active": {
      const end = input.currentPeriodEnd ? new Date(input.currentPeriodEnd).getTime() : null;
      if (end !== null && end <= t) {
        return { status: "active", writable: false, reason: "period_ended", trialDaysLeft: null };
      }
      return { status: "active", writable: true, reason: "active", trialDaysLeft: null };
    }
    case "past_due":
      return { status: "past_due", writable: true, reason: "past_due", trialDaysLeft: null };
    case "suspended":
      return { status: "suspended", writable: false, reason: "suspended", trialDaysLeft: null };
    case "cancelled":
      return { status: "cancelled", writable: false, reason: "cancelled", trialDaysLeft: null };
  }
}
