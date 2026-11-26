import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { localizedPath, routing } from "@/i18n/routing";
import { domainRedirect } from "@/lib/domains";
import type { Database } from "@/types/database";

const intl = createIntlMiddleware(routing);

/** Pages anyone can open without being logged in. */
const PUBLIC_PATHS = ["/", "/privacy", "/login", "/signup", "/forgot-password", "/reset-password", "/check-email", "/invite"];
/** Pages that make no sense once logged in. */
const GUEST_ONLY_PATHS = ["/login", "/forgot-password", "/check-email"];

function matches(path: string, list: string[]): boolean {
  return list.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`)));
}

function splitLocale(pathname: string): { locale: string; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first && (routing.locales as readonly string[]).includes(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: routing.defaultLocale, path: pathname };
}

/**
 * 0. Domains: marketing pages on NEXT_PUBLIC_MARKETING_URL, the app on NEXT_PUBLIC_SITE_URL.
 * 1. next-intl: locale prefix handling.
 * 2. Supabase: refresh the session cookie on every request.
 * 3. Optimistic redirects (login required / already logged in).
 *    The real checks happen again on the server (pages, actions) and in RLS.
 */
export async function proxy(request: NextRequest) {
  // 0. Two domains (app / marketing): send each page to its domain.
  const moved = domainRedirect(
    { host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"), pathname: request.nextUrl.pathname, search: request.nextUrl.search },
    { appUrl: process.env.NEXT_PUBLIC_SITE_URL, marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL },
  );
  if (moved) return NextResponse.redirect(moved, 308);

  const response = intl(request);
  if (response.headers.get("location")) return response;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims?.sub);
  const { locale, path } = splitLocale(request.nextUrl.pathname);

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    const [pathname, search = ""] = target.split("?");
    url.pathname = localizedPath(pathname, locale);
    url.search = search ? `?${search}` : "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!loggedIn && !matches(path, PUBLIC_PATHS)) {
    return redirectTo(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }
  // Two-step login: password done (aal1) but the code is still missing.
  if (loggedIn && data?.claims?.aal !== "aal2") {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsCode = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
    if (needsCode && path !== "/mfa" && path !== "/") return redirectTo(`/mfa?next=${encodeURIComponent(path + request.nextUrl.search)}`);
    if (!needsCode && path === "/mfa") return redirectTo("/dashboard");
  } else if (loggedIn && path === "/mfa") {
    return redirectTo("/dashboard");
  }
  if (loggedIn && matches(path, GUEST_ONLY_PATHS)) {
    return redirectTo("/dashboard");
  }
  return response;
}

export const config = {
  // Everything except API routes, auth route handlers, Next internals and files
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
