import "server-only";
import { z } from "zod";
import { DAMAGE_TYPES, type View } from "@/lib/inspections/model";

/**
 * AI comparison of one view: departure photo vs return photo → NEW damages.
 * Default: Groq's free image model (GROQ_API_KEY, VISION_MODEL to change it).
 * AI_PROVIDER=mock (tests, never on Vercel production) returns a fixed answer.
 */
export type VisionFinding = { type: (typeof DAMAGE_TYPES)[number]; x: number; y: number; description: string; confidence: number };
export type VisionResult = { ok: true; findings: VisionFinding[] } | { ok: false; error: "busy" | "unavailable" | "notConfigured"; retryAfter?: number };

const findingSchema = z.object({
  type: z.enum(DAMAGE_TYPES).catch("other"),
  x: z.coerce.number().min(0).max(1).catch(0.5),
  y: z.coerce.number().min(0).max(1).catch(0.5),
  description: z.string().max(200).catch(""),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
});
const answerSchema = z.object({ damages: z.array(z.unknown()).catch([]) });

export const MIN_CONFIDENCE = 0.55;

const VIEW_FR: Record<View, string> = {
  front: "l'avant",
  back: "l'arrière",
  left: "le côté gauche",
  right: "le côté droit",
  wheels: "les roues",
  roof: "le toit",
  interior: "l'intérieur",
  trunk: "le coffre",
};

export function visionPrompt(view: View): string {
  return [
    `Tu inspectes une voiture de location. Deux photos de ${VIEW_FR[view]} de la MÊME voiture : la 1re au DÉPART, la 2e au RETOUR.`,
    "Liste UNIQUEMENT les dégâts visibles sur la photo du RETOUR qui n'existent PAS sur la photo du DÉPART : rayures, bosses, vitre fissurée, pneu ou jante abîmé, pièce manquante, tache ou déchirure à l'intérieur.",
    "Ignore la saleté, la poussière, l'eau, les reflets, la lumière, l'angle ou le cadrage différents.",
    "Pour chaque dégât : type (scratch, dent, glass, tyre, interior, missing, other), x et y = centre du dégât sur la photo du RETOUR (0 à 1 depuis le coin haut gauche), description courte en français, confidence de 0 à 1.",
    'Réponds seulement en JSON : {"damages":[{"type":"scratch","x":0.4,"y":0.6,"description":"Rayure sur la portière","confidence":0.8}]}. Aucun dégât nouveau : {"damages":[]}.',
  ].join("\n");
}

/** Pull the first {...} JSON object out of a model answer and validate it. */
export function parseFindings(text: string): VisionFinding[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  return answerSchema
    .parse(raw)
    .damages.map((d) => findingSchema.safeParse(d))
    .filter((r) => r.success)
    .map((r) => r.data as VisionFinding)
    .filter((f) => f.confidence >= MIN_CONFIDENCE)
    .slice(0, 6);
}

export function visionConfigured(): boolean {
  return (process.env.AI_PROVIDER === "mock" && process.env.VERCEL_ENV !== "production") || Boolean(process.env.GROQ_API_KEY);
}

export async function compareView(view: View, before: Uint8Array, after: Uint8Array): Promise<VisionResult> {
  if (process.env.AI_PROVIDER === "mock" && process.env.VERCEL_ENV !== "production") {
    // Deterministic answer for tests: one new scratch on the right side.
    return { ok: true, findings: view === "right" ? [{ type: "scratch", x: 0.4, y: 0.55, description: "Rayure sur la portière arrière", confidence: 0.86 }] : [] };
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, error: "notConfigured" };
  const model = process.env.VISION_MODEL || "qwen/qwen3.8-27b";
  const img = (b: Uint8Array) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${Buffer.from(b).toString("base64")}` } });
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_completion_tokens: 700,
        ...(model.startsWith("qwen/") ? { reasoning_format: "hidden" } : {}),
        messages: [{ role: "user", content: [{ type: "text", text: visionPrompt(view) }, img(before), img(after)] }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (res.status === 429) {
    const body = await res.text().catch(() => "");
    const header = Number(res.headers.get("retry-after"));
    const inText = /try again in ([\d.]+)s/.exec(body);
    return { ok: false, error: "busy", retryAfter: Number.isFinite(header) && header > 0 ? header : inText ? Number(inText[1]) : 20 };
  }
  if (!res.ok) return { ok: false, error: "unavailable" };
  const data = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
  const text = (data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  return { ok: true, findings: parseFindings(text) };
}
