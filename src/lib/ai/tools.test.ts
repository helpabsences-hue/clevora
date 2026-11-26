import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { TOOLS, toolsFor } = await import("./tools");
const { runTool } = await import("./provider");

describe("assistant tools", () => {
  it("staff never get money tools", () => {
    const names = toolsFor("staff").map((t) => t.name);
    expect(names).not.toContain("revenue");
    expect(names).not.toContain("charges");
    expect(names).toContain("who_had_car");
    expect(toolsFor("admin").map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
  });

  it("refuses a money tool for staff even if the model asks for it", async () => {
    const rpc = vi.fn();
    const ctx = { supabase: { rpc } as never, agencyId: "a", role: "staff" as const, now: new Date(), alertDays: 30, alertKm: 1500 };
    const r = await runTool(TOOLS, ctx, "revenue", { from: "2026-11-01", to: "2026-11-09" });
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates the model's input before running a tool", async () => {
    const rpc = vi.fn();
    const ctx = { supabase: { rpc } as never, agencyId: "a", role: "admin" as const, now: new Date(), alertDays: 30, alertKm: 1500 };
    const r = await runTool(TOOLS, ctx, "who_had_car", { plate: "12345-A-6", date: "hier" });
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect((await runTool(TOOLS, ctx, "drop_table", {})).ok).toBe(false);
  });

  it("every tool has a JSON schema for the model", async () => {
    const { z } = await import("zod");
    for (const t of TOOLS) expect((z.toJSONSchema(t.schema, { io: "input" }) as { type: string }).type).toBe("object");
  });
});
