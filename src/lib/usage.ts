/**
 * Supabase usage vs. plan limits. Defaults are the Supabase Free plan;
 * change them with env variables when you move to Pro.
 */
export type Usage = { database_bytes: number; storage_bytes: number; active_users_30d: number };
export type UsageMetric = "database" | "storage" | "activeUsers";

const MB = 1024 * 1024;
const GB = 1024 * MB;

export function usageLimits(env: Record<string, string | undefined> = process.env): Record<UsageMetric, number> {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    database: num(env.SUPABASE_LIMIT_DB_MB, 500) * MB,
    storage: num(env.SUPABASE_LIMIT_STORAGE_GB, 1) * GB,
    activeUsers: num(env.SUPABASE_LIMIT_MAU, 50_000),
  };
}

export type UsageLine = { metric: UsageMetric; used: number; limit: number; pct: number; level: 0 | 80 | 95 };

export function usageLines(u: Usage, limits = usageLimits()): UsageLine[] {
  const rows: Array<[UsageMetric, number]> = [
    ["database", u.database_bytes],
    ["storage", u.storage_bytes],
    ["activeUsers", u.active_users_30d],
  ];
  return rows.map(([metric, used]) => {
    const pct = Math.round((used / limits[metric]) * 100);
    return { metric, used, limit: limits[metric], pct, level: pct >= 95 ? 95 : pct >= 80 ? 80 : 0 };
  });
}

/** "312 Mo" / "1,2 Go" / "4 210". */
export function formatUsage(metric: UsageMetric, n: number): string {
  if (metric === "activeUsers") return new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ");
  return n >= GB ? `${(n / GB).toFixed(1).replace(".", ",")} Go` : `${Math.round(n / MB)} Mo`;
}
