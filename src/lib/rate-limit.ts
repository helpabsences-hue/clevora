import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Limits per action: attempts allowed per window (seconds). */
export const LIMITS = {
  loginIp: [20, 15 * 60],
  loginEmail: [8, 15 * 60],
  emailLinkIp: [10, 60 * 60],
  emailLinkEmail: [5, 60 * 60],
  signupIp: [8, 60 * 60],
  invite: [40, 60 * 60],
  assistant: [20, 60],
} as const satisfies Record<string, readonly [number, number]>;

export type LimitName = keyof typeof LIMITS;

/** The visitor's address as seen by Vercel / the local server. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Automated tests log in hundreds of times from one machine: their addresses
 * can be listed in RATE_LIMIT_EXEMPT_IPS. Never honoured on the live site.
 */
async function exempt(): Promise<boolean> {
  const list = process.env.RATE_LIMIT_EXEMPT_IPS;
  if (!list || process.env.VERCEL_ENV === "production") return false;
  const ip = await clientIp();
  return list.split(",").map((x) => x.trim()).includes(ip);
}

/** Keys are hashed: the table never stores e-mails or addresses in clear. */
function hashKey(name: string, value: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return `${name}:${createHash("sha256").update(`${pepper}|${value.toLowerCase()}`).digest("hex").slice(0, 40)}`;
}

/**
 * Count one attempt. Returns false when the limit is reached.
 * If the database cannot be reached we let the request through (never lock
 * everybody out because of the limiter itself).
 */
export async function rateLimit(name: LimitName, value: string): Promise<boolean> {
  if (await exempt()) return true;
  const [limit, windowSeconds] = LIMITS[name];
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: hashKey(name, value), p_limit: limit, p_window_seconds: windowSeconds });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** Several checks at once (e.g. per address AND per e-mail); all are counted. */
export async function rateLimitAll(checks: Array<[LimitName, string]>): Promise<boolean> {
  const results = await Promise.all(checks.map(([n, v]) => rateLimit(n, v)));
  return results.every(Boolean);
}
