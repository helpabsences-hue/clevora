import "server-only";
import type { AssistantTool, Source, ToolContext } from "./tools";

/** What the chat route streams to the browser, one JSON object per line. */
export type AssistantEvent =
  | { type: "tool"; name: string }
  | { type: "text"; delta: string }
  | { type: "sources"; sources: Source[] }
  | { type: "done"; tools: string[]; inputTokens: number; outputTokens: number }
  | { type: "error"; error: "refused" | "unavailable" | "busy" | "tooLong" };

export type AssistantRequest = {
  system: string;
  user: string;
  tools: AssistantTool[];
  ctx: ToolContext;
  signal?: AbortSignal;
};

/** Any LLM vendor can be plugged in behind this interface. */
export interface AssistantProvider {
  answer(request: AssistantRequest): AsyncGenerator<AssistantEvent>;
}

/** Runs one tool call: validate the model's input, check the role, run with the user's RLS. */
export async function runTool(
  tools: AssistantTool[],
  ctx: ToolContext,
  name: string,
  input: unknown,
): Promise<{ ok: true; content: string; sources: Source[] } | { ok: false; content: string }> {
  const tool = tools.find((t) => t.name === name);
  if (!tool || (tool.roles && !tool.roles.includes(ctx.role))) return { ok: false, content: "Outil non disponible pour cet utilisateur." };
  const parsed = tool.schema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, content: `Paramètres invalides : ${parsed.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}` };
  try {
    const out = await tool.run(ctx, parsed.data as Record<string, unknown>);
    return { ok: true, content: JSON.stringify(out.data), sources: out.sources };
  } catch {
    return { ok: false, content: "L'outil a échoué. Réessayez plus tard." };
  }
}

export async function getProvider(): Promise<AssistantProvider | null> {
  // The offline stand-in is for tests and local dev only, never on the live site.
  if (process.env.AI_PROVIDER === "mock" && process.env.VERCEL_ENV !== "production") {
    const { MockProvider } = await import("./mock");
    return new MockProvider();
  }
  // Groq (free models, 3-model fallback) when its key is set; Claude otherwise.
  // AI_PROVIDER=groq|anthropic forces one when both keys exist.
  const forced = process.env.AI_PROVIDER;
  if (process.env.GROQ_API_KEY && forced !== "anthropic") {
    const { GroqProvider } = await import("./groq");
    return new GroqProvider(process.env.GROQ_API_KEY);
  }
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const { AnthropicProvider } = await import("./anthropic");
  return new AnthropicProvider();
}
