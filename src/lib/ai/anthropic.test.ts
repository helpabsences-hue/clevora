import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** A fake Claude endpoint: first a tool call (oil_due), then a text answer. */
type Captured = { headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> };
const requests: Captured[] = [];
let server: Server;

function sse(events: Array<Record<string, unknown>>): string {
  return events.map((e) => `event: ${e.type as string}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}
const start = (id: string) => ({
  type: "message_start",
  message: { id, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 1 } },
});

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({ headers: req.headers, body: JSON.parse(raw) });
      res.writeHead(200, { "content-type": "text/event-stream" });
      if (requests.length === 1) {
        res.end(
          sse([
            start("msg_1"),
            { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "oil_due", input: {} } },
            { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{}" } },
            { type: "content_block_stop", index: 0 },
            { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 20 } },
            { type: "message_stop" },
          ]),
        );
      } else {
        res.end(
          sse([
            start("msg_2"),
            { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "La **Clio** a besoin " } },
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "d'une vidange." } },
            { type: "content_block_stop", index: 0 },
            { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 12 } },
            { type: "message_stop" },
          ]),
        );
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterAll(() => server.close());

describe("AnthropicProvider", () => {
  it("runs the tool loop, streams text and returns sources", async () => {
    const { AnthropicProvider } = await import("./anthropic");
    const { toolsFor } = await import("./tools");
    const eq = () => chain;
    const chain = {
      select: () => chain,
      eq,
      then: (ok: (v: unknown) => void) => ok({ data: [{ id: "v1", plate: "1-A-6", brand_model: "Renault Clio", current_km: 60100, oil_next_km: 60000 }], error: null }),
    };
    const supabase = { from: () => chain } as never;
    const events = [];
    for await (const e of new AnthropicProvider().answer({
      system: "sys",
      user: "Quelles voitures ont besoin d'une vidange ?",
      tools: toolsFor("staff"),
      ctx: { supabase, agencyId: "a", role: "staff", now: new Date(), alertDays: 30, alertKm: 1500 },
    })) events.push(e);

    const text = events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toContain("La **Clio** a besoin d'une vidange.");
    expect(events).toContainEqual({ type: "tool", name: "oil_due" });
    expect(events).toContainEqual({ type: "sources", sources: [{ label: "Vidange", href: "/oil" }] });
    expect(events.at(-1)).toMatchObject({ type: "done", tools: ["oil_due"], outputTokens: 32 });

    expect(requests).toHaveLength(2);
    const [first, second] = requests;
    expect(first.headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    expect(first.body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low" }, stream: true });
    const names = (first.body.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain("oil_due");
    expect(names).not.toContain("revenue"); // staff
    const last = (second.body.messages as Array<{ role: string; content: unknown }>).at(-1)!;
    expect(last.role).toBe("user");
    expect(JSON.stringify(last.content)).toContain("Renault Clio 1-A-6");
    expect(JSON.stringify(last.content)).toContain("toolu_1");
  });
});
