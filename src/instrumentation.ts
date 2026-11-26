import { SENTRY_DSN, SENTRY_OPTIONS } from "@/lib/monitoring";
import type { Instrumentation } from "next";

/** Server / edge error monitoring (only when a Sentry DSN is configured). */
export async function register() {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(SENTRY_OPTIONS);
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
