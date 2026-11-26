import { SENTRY_DSN, SENTRY_OPTIONS } from "@/lib/monitoring";

/**
 * Browser error monitoring. The Sentry library is only downloaded when a DSN
 * is configured, so the app stays light when monitoring is off.
 */
if (SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init(SENTRY_OPTIONS));
}
