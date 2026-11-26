import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { runTool, type AssistantEvent, type AssistantProvider, type AssistantRequest } from "./provider";
import type { Source } from "./tools";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_ROUNDS = 6;

let client: Anthropic | null = null;

function toolDefs(request: AssistantRequest): Anthropic.Beta.BetaTool[] {
  return request.tools.map((t) => {
    const schema = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name: t.name,
      description: t.description,
      input_schema: { ...schema, type: "object" } as Anthropic.Beta.BetaTool.InputSchema,
      eager_input_streaming: true,
    };
  });
}

/** Claude, with our own tools, in a streaming manual loop (append-only within one question). */
export class AnthropicProvider implements AssistantProvider {
  async *answer(request: AssistantRequest): AsyncGenerator<AssistantEvent> {
    client ??= new Anthropic();
    const tools = toolDefs(request);
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: request.user }];
    const used: string[] = [];
    const sources = new Map<string, Source>();
    let inputTokens = 0;
    let outputTokens = 0;
    let jsonRetries = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let message: Anthropic.Beta.BetaMessage;
      let wrote = false;
      try {
        const stream = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 8000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low" },
            system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
            tools,
            messages,
          },
          { signal: request.signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            wrote = true;
            yield { type: "text", delta: event.delta.text };
          }
        }
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          yield { type: "error", error: "busy" };
          return;
        }
        if (err instanceof Anthropic.APIError) {
          yield { type: "error", error: "unavailable" };
          return;
        }
        // A tool input that could not be parsed at all: re-issue the turn (twice at most).
        if (request.signal?.aborted || jsonRetries++ >= 2) {
          yield { type: "error", error: "unavailable" };
          return;
        }
        continue;
      }
      inputTokens += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
      outputTokens += message.usage.output_tokens;

      if (message.stop_reason === "refusal") {
        yield { type: "error", error: "refused" };
        return;
      }
      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: message.content });
        continue;
      }
      const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (!calls.length) break;
      if (message.stop_reason === "max_tokens") {
        yield { type: "error", error: "tooLong" };
        return;
      }
      messages.push({ role: "assistant", content: message.content });
      const results = await Promise.all(
        calls.map(async (call) => {
          used.push(call.name);
          return { call, result: await runTool(request.tools, request.ctx, call.name, call.input) };
        }),
      );
      for (const { call } of results) yield { type: "tool", name: call.name };
      const content: Anthropic.Beta.BetaToolResultBlockParam[] = results.map(({ call, result }) => {
        if (result.ok) for (const s of result.sources) sources.set(s.href, s);
        return { type: "tool_result", tool_use_id: call.id, content: result.content, ...(result.ok ? {} : { is_error: true }) };
      });
      messages.push({ role: "user", content });
      // Separate the text of two rounds.
      if (wrote) yield { type: "text", delta: "\n\n" };
    }
    if (sources.size) yield { type: "sources", sources: [...sources.values()].slice(0, 8) };
    yield { type: "done", tools: used, inputTokens, outputTokens };
  }
}
