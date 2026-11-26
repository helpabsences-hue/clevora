/**
 * Two domains, one app:
 *   NEXT_PUBLIC_SITE_URL       the app (e.g. https://app.parcolia.ma) — logins, agencies, email links
 *   NEXT_PUBLIC_MARKETING_URL  optional public site (e.g. https://parcolia.ma)
 * Without NEXT_PUBLIC_MARKETING_URL (or with the same host) everything lives on one domain.
 * Any other host (Vercel previews, localhost) is never redirected.
 */
const LOCALES = ["fr", "ar", "en"] as const;
/** Pages served by the marketing domain; everything else belongs to the app. */
const MARKETING_PATHS = ["/", "/privacy"];

function stripLocale(pathname: string): { prefix: string; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if ((LOCALES as readonly string[]).includes(first ?? "")) return { prefix: `/${first}`, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
  return { prefix: "", path: pathname.replace(/\/$/, "") || "/" };
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function domainRedirect(
  req: { host: string | null; pathname: string; search: string },
  env: { appUrl?: string; marketingUrl?: string },
): string | null {
  const appHost = hostOf(env.appUrl);
  const marketingHost = hostOf(env.marketingUrl);
  const host = (req.host ?? "").toLowerCase();
  if (!appHost || !marketingHost || appHost === marketingHost || !host) return null;
  const { prefix, path } = stripLocale(req.pathname);
  const appOrigin = new URL(env.appUrl!).origin;
  const marketingOrigin = new URL(env.marketingUrl!).origin;

  // www.parcolia.ma -> parcolia.ma
  if (host === `www.${marketingHost}`) return `${marketingOrigin}${req.pathname}${req.search}`;
  if (host === marketingHost) {
    return MARKETING_PATHS.includes(path) ? null : `${appOrigin}${req.pathname}${req.search}`;
  }
  if (host === appHost && path === "/") {
    // The app's front door is the dashboard (the login page if logged out).
    return `${appOrigin}${prefix}/dashboard${req.search}`;
  }
  return null;
}
