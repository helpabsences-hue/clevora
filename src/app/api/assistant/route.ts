import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildAgencyContext } from "@/lib/ai/context";
import { rateLimit } from "@/lib/rate-limit";
import { buildSystemPrompt, buildUserMessage, MAX_QUESTION } from "@/lib/ai/prompt";
import { getProvider, type AssistantEvent } from "@/lib/ai/provider";
import { toolsFor } from "@/lib/ai/tools";
import { getActiveAgency, getUser } from "@/lib/auth/session";
import { dayKey, TIME_ZONE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(20)
    .default([]),
  locale: z.enum(["fr", "ar", "en"]).default("fr"),
});

function json(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Assistant IA: answers one question, streaming NDJSON events.
 * Tools run with the user's own Supabase session (RLS), and staff never get money tools.
 * Nothing of the conversation is stored; one activity_log row records the tools used.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return json("notLoggedIn", 401);
  const agency = await getActiveAgency();
  if (!agency) return json("noAgency", 403);
  if (!(await rateLimit("assistant", user.id))) return json("busy", 429);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json("invalidForm", 400);

  const supabase = await createClient();
  const [{ data: quotaRows }, { data: settings }] = await Promise.all([
    supabase.rpc("ai_quota", { p_agency: agency.id }),
    supabase.from("agencies").select("alert_days_before, alert_km_before").eq("id", agency.id).single(),
  ]);
  const quota = quotaRows?.[0];
  if (!quota?.plan_allows) return json("aiNotInPlan", 403);
  if (!quota.enabled) return json("aiDisabled", 403);
  if (quota.quota !== null && quota.used >= quota.quota) return json("aiQuota", 429);
  const provider = await getProvider();
  if (!provider) return json("aiNotConfigured", 503);

  const now = new Date();
  const { question, history, locale } = parsed.data;
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: TIME_ZONE }).format(now);
  const today = dayKey(now);
  const tools = toolsFor(agency.role);
  const ctx = {
    supabase,
    agencyId: agency.id,
    role: agency.role,
    now,
    alertDays: settings?.alert_days_before ?? 30,
    alertKm: settings?.alert_km_before ?? 1500,
  };
  // Retrieval: a fresh picture of THIS agency's data (user's session + agency filter).
  const agencyData = await buildAgencyContext(ctx, agency.name);
  const events = provider.answer({
    system: buildSystemPrompt({ agencyName: agency.name, role: agency.role, today, weekday, locale }),
    user: buildUserMessage(history, question, agencyData),
    tools,
    ctx,
    signal: request.signal,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AssistantEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      let tools: string[] = [];
      let tokens = { input: 0, output: 0 };
      try {
        for await (const e of events) {
          if (e.type === "done") {
            tools = e.tools;
            tokens = { input: e.inputTokens, output: e.outputTokens };
          }
          send(e);
        }
      } catch {
        send({ type: "error", error: "unavailable" });
      } finally {
        // Privacy: no question or answer text, only which tools were used.
        await supabase.from("activity_log").insert({
          agency_id: agency.id,
          actor_id: user.id,
          action: "assistant.question",
          entity: "assistant",
          details: { tools: [...new Set(tools)], input_tokens: tokens.input, output_tokens: tokens.output },
        });
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
