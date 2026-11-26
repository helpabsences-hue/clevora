import "server-only";
import { z } from "zod";
import { runTool, type AssistantEvent, type AssistantProvider, type AssistantRequest } from "./provider";
import type { Source } from "./tools";

/**
 * Groq (OpenAI-compatible API), free models, with a fallback chain: if a model is
 * down, rate-limited or fails a tool call, the next one answers. Order and models can
 * be changed with GROQ_MODELS (comma-separated) without touching the code.
 */
export const DEFAULT_GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
const API = "https://api.groq.com/openai/v1/chat/completions";
const MAX_ROUNDS = 6;
/** No first byte after this long: try the next model. */
const FIRST_BYTE_MS = 20_000;
/** Wait at most this long (seconds) when every model is rate-limited. */
const MAX_WAIT_S = 8;

export function groqModels(env: Record<string, string | undefined> = process.env): string[] {
  const list = (env.GROQ_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_GROQ_MODELS;
}

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type Chunk = {
  choices?: Array<{
    delta?: { content?: string | null; reasoning?: string | null; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number }; error?: string };
  error?: { message?: string };
};

/** Errors that mean "this model cannot answer now": move on to the next one. */
class ModelUnavailable extends Error {
  constructor(
    readonly model: string,
    readonly status: number | null,
    detail: string,
    /** Seconds Groq asks us to wait (rate limits). */
    readonly retryAfter: number | null = null,
  ) {
    super(`${model}: ${status ?? "network"} ${detail}`.slice(0, 300));
  }
}

/**
 * Free models have small per-minute token budgets: drop what the model does not
 * need (regex patterns of dates, $schema). Inputs are validated by zod anyway.
 */
export function slimSchema<T>(node: T): T {
  if (Array.isArray(node)) return node.map(slimSchema) as T;
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "pattern" || k === "$schema") continue;
      out[k] = slimSchema(v);
    }
    return out as T;
  }
  return node;
}

function toolDefs(request: AssistantRequest) {
  return request.tools.map((t) => {
    const schema = slimSchema(z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>);
    return { type: "function" as const, function: { name: t.name, description: t.description, parameters: { ...schema, type: "object" } } };
  });
}

/** Model-specific switches so the hidden "thinking" never reaches the user. */
function reasoningParams(model: string): Record<string, unknown> {
  if (model.startsWith("openai/gpt-oss")) return { include_reasoning: false, reasoning_effort: "low" };
  if (model.startsWith("qwen/")) return { reasoning_format: "hidden" };
  return {};
}

/** Removes <think>…</think> blocks some models still write in the text. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "");
}

/** Reads an SSE stream from the chat completions API. */
async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<Chunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        yield JSON.parse(data) as Chunk;
      } catch {
        // ignore a broken keep-alive line
      }
    }
  }
}

type RoundResult = { text: string; calls: ToolCall[]; finish: string | null; inputTokens: number; outputTokens: number };

export class GroqProvider implements AssistantProvider {
  constructor(
    private readonly apiKey: string,
    private readonly models: string[] = groqModels(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /**
   * One model call: yields the text as it streams, returns the tool calls. Throws
   * ModelUnavailable when the model fails before writing anything (next model).
   */
  private async *round(model: string, messages: Message[], tools: ReturnType<typeof toolDefs>, signal: AbortSignal | undefined): AsyncGenerator<string, RoundResult> {
    const firstByte = AbortSignal.timeout(FIRST_BYTE_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(API, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: "auto",
          stream: true,
          temperature: 0.2,
          max_completion_tokens: 1500,
          ...reasoningParams(model),
        }),
        signal: signal ? AbortSignal.any([signal, firstByte]) : firstByte,
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new ModelUnavailable(model, null, e instanceof Error ? e.message : "fetch failed");
    }
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      const header = Number(res.headers.get("retry-after"));
      const inText = /try again in ([\d.]+)s/.exec(detail);
      const retryAfter = Number.isFinite(header) && header > 0 ? header : inText ? Number(inText[1]) : null;
      throw new ModelUnavailable(model, res.status, detail, retryAfter);
    }

    let text = "";
    let wrote = false;
    let finish: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    const calls = new Map<number, ToolCall>();
    let inThink = false;
    try {
      for await (const chunk of sse(res.body)) {
        if (chunk.error || chunk.x_groq?.error) throw new ModelUnavailable(model, 500, chunk.error?.message ?? chunk.x_groq?.error ?? "stream error");
        const usage = chunk.x_groq?.usage ?? chunk.usage;
        if (usage) {
          inputTokens = usage.prompt_tokens ?? inputTokens;
          outputTokens = usage.completion_tokens ?? outputTokens;
        }
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finish = choice.finish_reason;
        const delta = choice.delta ?? {};
        if (delta.content) {
          // Hide any <think> block that slipped through, even split across chunks.
          let piece = delta.content;
          if (inThink || piece.includes("<think>")) {
            const joined = (inThink ? "<think>" : "") + piece;
            inThink = /<think>(?![\s\S]*<\/think>)/.test(joined);
            piece = stripThinking(joined);
          }
          // Some models write plates with a non-breaking hyphen (12345‑A‑6): keep a plain "-".
          piece = piece.replace(/[\u2010\u2011]/g, "-");
          if (piece) {
            text += piece;
            wrote = true;
            yield piece;
          }
        }
        for (const tc of delta.tool_calls ?? []) {
          const cur = calls.get(tc.index) ?? { id: "", type: "function" as const, function: { name: "", arguments: "" } };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.function.name += tc.function.name;
          if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
          calls.set(tc.index, cur);
        }
      }
    } catch (e) {
      if (signal?.aborted) throw e;
      if (!wrote) throw e instanceof ModelUnavailable ? e : new ModelUnavailable(model, null, "stream cut");
      throw e;
    }
    return { text, calls: [...calls.values()].filter((c) => c.function.name), finish, inputTokens, outputTokens };
  }

  async *answer(request: AssistantRequest): AsyncGenerator<AssistantEvent> {
    const tools = toolDefs(request);
    const messages: Message[] = [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ];
    const used: string[] = [];
    const sources = new Map<string, Source>();
    let inputTokens = 0;
    let outputTokens = 0;
    // The model that answered last stays first in line for the next round.
    let order = [...this.models];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let result: RoundResult | null = null;
      let rateLimited = false;
      let shortestWait = Infinity;
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        if (attempt === 1) {
          // Every model is rate-limited for a few seconds only: wait once, then retry.
          if (!rateLimited || shortestWait > MAX_WAIT_S) break;
          await new Promise((r) => setTimeout(r, Math.ceil(shortestWait * 1000) + 250));
          if (request.signal?.aborted) return;
        }
      for (const model of order) {
        let wrote = false;
        try {
          const gen = this.round(model, messages, tools, request.signal);
          for (;;) {
            const step = await gen.next();
            if (step.done) {
              result = step.value;
              break;
            }
            wrote = true;
            yield { type: "text", delta: step.value };
          }
          order = [model, ...order.filter((m) => m !== model)];
          break;
        } catch (e) {
          if (request.signal?.aborted) return;
          if (e instanceof ModelUnavailable && !wrote) {
            if (e.status === 429) {
              rateLimited = true;
              shortestWait = Math.min(shortestWait, e.retryAfter ?? Infinity);
            }
            console.warn(`[assistant] ${e.message}`);
            continue;
          }
          // Cut in the middle of an answer: say so rather than mixing two answers.
          yield { type: "error", error: "unavailable" };
          return;
        }
      }
      }
      if (!result) {
        yield { type: "error", error: rateLimited ? "busy" : "unavailable" };
        return;
      }
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;

      if (!result.calls.length) {
        if (result.finish === "length") {
          yield { type: "error", error: "tooLong" };
          return;
        }
        break;
      }
      messages.push({ role: "assistant", content: result.text || null, tool_calls: result.calls });
      const outcomes = await Promise.all(
        result.calls.map(async (call) => {
          used.push(call.function.name);
          let input: unknown;
          try {
            input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            return { call, result: { ok: false as const, content: "INVALID_JSON: arguments must be valid JSON matching the schema." } };
          }
          return { call, result: await runTool(request.tools, request.ctx, call.function.name, input) };
        }),
      );
      for (const { call } of outcomes) yield { type: "tool", name: call.function.name };
      for (const { call, result: r } of outcomes) {
        if (r.ok) for (const s of r.sources) sources.set(s.href, s);
        messages.push({ role: "tool", tool_call_id: call.id, content: r.content });
      }
      if (result.text) yield { type: "text", delta: "\n\n" };
    }
    if (sources.size) yield { type: "sources", sources: [...sources.values()].slice(0, 8) };
    yield { type: "done", tools: used, inputTokens, outputTokens };
  }
}
