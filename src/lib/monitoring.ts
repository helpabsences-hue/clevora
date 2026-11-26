import type { ErrorEvent } from "@sentry/nextjs"; // type only: no code is bundled

/**
 * Error monitoring (Sentry) — off unless NEXT_PUBLIC_SENTRY_DSN is set.
 * Personal data never leaves: no IP, no cookies, no request bodies, no user
 * e-mail; only the error, the page path and the anonymous user id.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      const keep: Record<string, string> = {};
      for (const k of ["user-agent", "referer"]) if (event.request.headers[k]) keep[k] = event.request.headers[k];
      event.request.headers = keep;
    }
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}

export const SENTRY_OPTIONS = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
  // The git commit (Vercel exposes it): errors are grouped per release.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  sendDefaultPii: false,
  tracesSampleRate: 0.05,
  beforeSend: scrubEvent,
};
