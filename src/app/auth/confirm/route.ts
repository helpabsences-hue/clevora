import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { localizedPath } from "@/i18n/routing";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "magiclink", "invite", "email_change"];

/** `next` is a path ("/reset-password") or a full URL (Supabase {{ .RedirectTo }}): keep only the path. */
function nextPath(raw: string | null, origin: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, origin);
    return safeNextPath(url.pathname + url.search);
  } catch {
    return null;
  }
}

function stripLocale(path: string): string {
  const m = /^\/(fr|ar|en)(\/.*)?$/.exec(path);
  return m ? m[2] || "/" : path;
}

/**
 * Links in Supabase emails (confirmation, password reset, magic link, email
 * change) land here with a token_hash. We verify it, which opens the session,
 * then send the user to `next` in their own language.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = nextPath(searchParams.get("next"), origin) ?? "/dashboard";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_locale")
        .eq("id", data.user.id)
        .maybeSingle();
      const locale = profile?.preferred_locale ?? "fr";
      return NextResponse.redirect(new URL(localizedPath(stripLocale(next), locale), origin));
    }
  }

  const failed = type === "recovery" ? "/forgot-password?expired=1" : "/login?expired=1";
  return NextResponse.redirect(new URL(failed, origin));
}
