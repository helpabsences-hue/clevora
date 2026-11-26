import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const { GroqProvider, groqModels, stripThinking, DEFAULT_GROQ_MODELS } = await import("./groq");

const tools = [
  {
    name: "free_cars",
    description: "Voitures libres",
    schema: z.object({}),
    run: async () => ({ data: [{ voiture: "Dacia Logan 12345-A-6" }], sources: [{ label: "Parc auto", href: "/fleet" }] }),
  },
];

function sseBody(chunks: object[]): ReadableStream<Uint8Array> {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(text).body!;
}
const toolCall = sseBody([
  { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "free_cars", arguments: "" } }] } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] }, finish_reason: "tool_calls" }], x_groq: { usage: { prompt_tokens: 50, completion_tokens: 5 } } },
]);
const answer = (t: string) => sseBody([{ choices: [{ delta: { content: t } }] }, { choices: [{ delta: {}, finish_reason: "stop" }], x_groq: { usage: { prompt_tokens: 80, completion_tokens: 10 } } }]);

async function collect(p: InstanceType<typeof GroqProvider>) {
  const events: Array<Record<string, unknown>> = [];
  for await (const e of p.answer({ system: "s", user: "u", tools: tools as never, ctx: { role: "admin" } as never })) events.push(e);
  return events;
}

describe("GroqProvider", () => {
  it("falls back to the next model when one is rate-limited or down, then keeps the one that works", async () => {
    const calls: string[] = [];
    const fake = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const model = JSON.parse(String(init!.body)).model as string;
      calls.push(model);
      if (model === "a") return new Response("rate limited", { status: 429 });
      if (model === "b") return new Response("down", { status: 503 });
      return new Response(calls.filter((m) => m === "c").length === 1 ? toolCall : answer("Libre : Dacia Logan 12345‑A‑6"));
    });
    const events = await collect(new GroqProvider("k", ["a", "b", "c"], fake as typeof fetch));
    expect(calls).toEqual(["a", "b", "c", "c"]); // second round starts with the model that worked
    expect(events.filter((e) => e.type === "text").map((e) => e.delta).join("")).toBe("Libre : Dacia Logan 12345-A-6");
    expect(events.map((e) => e.type)).toEqual(["tool", "text", "sources", "done"]);
    expect(events.at(-1)).toMatchObject({ tools: ["free_cars"], inputTokens: 130, outputTokens: 15 });
  });

  it("all models rate-limited: 'busy'; all down: 'unavailable'", async () => {
    const busy = await collect(new GroqProvider("k", ["a", "b"], (async () => new Response("", { status: 429 })) as typeof fetch));
    expect(busy).toEqual([{ type: "error", error: "busy" }]);
    const down = await collect(new GroqProvider("k", ["a", "b"], (async () => { throw new TypeError("fetch failed"); }) as typeof fetch));
    expect(down).toEqual([{ type: "error", error: "unavailable" }]);
  });

  it("models come from GROQ_MODELS, with 3 free models by default", () => {
    expect(groqModels({})).toEqual(DEFAULT_GROQ_MODELS);
    expect(DEFAULT_GROQ_MODELS).toHaveLength(3);
    expect(groqModels({ GROQ_MODELS: " x , y ,," })).toEqual(["x", "y"]);
  });

  it("hides <think> blocks", () => {
    expect(stripThinking("<think>secret</think>Bonjour")).toBe("Bonjour");
    expect(stripThinking("Bonjour<think>pas fini")).toBe("Bonjour");
  });
});
