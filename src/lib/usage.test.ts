import { describe, expect, it } from "vitest";
import { formatUsage, usageLimits, usageLines } from "./usage";

const MB = 1024 * 1024;

describe("usage", () => {
  it("free plan limits by default, overridable for Pro", () => {
    expect(usageLimits({}).database).toBe(500 * MB);
    expect(usageLimits({ SUPABASE_LIMIT_DB_MB: "8192" }).database).toBe(8192 * MB);
    expect(usageLimits({ SUPABASE_LIMIT_MAU: "abc" }).activeUsers).toBe(50_000);
  });
  it("levels: nothing under 80 %, warning at 80 %, urgent at 95 %", () => {
    const lines = usageLines({ database_bytes: 410 * MB, storage_bytes: 100 * MB, active_users_30d: 48_000 }, usageLimits({}));
    expect(lines.map((l) => [l.metric, l.level])).toEqual([
      ["database", 80],
      ["storage", 0],
      ["activeUsers", 95],
    ]);
  });
  it("formats sizes in Mo / Go", () => {
    expect(formatUsage("database", 312 * MB)).toBe("312 Mo");
    expect(formatUsage("storage", 1.25 * 1024 * MB)).toBe("1,3 Go");
    expect(formatUsage("activeUsers", 4210)).toBe("4 210");
  });
});
