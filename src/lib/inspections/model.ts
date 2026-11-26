/** Inspection départ / retour: views to photograph, damage types, drawing geometry. */
export const VIEWS = ["front", "back", "left", "right", "wheels", "roof", "interior", "trunk"] as const;
export type View = (typeof VIEWS)[number];
/** The four faces are required; the rest is optional. */
export const REQUIRED_VIEWS: readonly View[] = ["front", "back", "left", "right"];
/** Groups shown as chips, like the inspection screen: Faces, Roues, Toit, Intérieur, Coffre. */
export const VIEW_GROUPS: Array<{ key: "faces" | "wheels" | "roof" | "interior" | "trunk"; views: View[] }> = [
  { key: "faces", views: ["front", "back", "left", "right"] },
  { key: "wheels", views: ["wheels"] },
  { key: "roof", views: ["roof"] },
  { key: "interior", views: ["interior"] },
  { key: "trunk", views: ["trunk"] },
];

export const DAMAGE_TYPES = ["scratch", "dent", "glass", "tyre", "interior", "missing", "other"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export type Damage = { id: string; x: number; y: number; type: DamageType; view: View | null; note: string | null; source: "staff" | "ai"; confirmed: boolean };

/**
 * The drawing is a car seen from above, FRONT AT THE TOP, its left side on the left.
 * x, y go from 0 to 1. Each view has a zone of the drawing.
 */
export function viewOfPoint(x: number, y: number): View {
  if (y < 0.2) return "front";
  if (y > 0.8) return "back";
  if (x < 0.3) return "left";
  if (x > 0.7) return "right";
  return "roof";
}

const clamp = (n: number, min = 0.04, max = 0.96) => Math.min(max, Math.max(min, n));

/**
 * A point found by the AI on a PHOTO of a view (px, py from the photo's top-left)
 * → a point on the drawing. Photos are taken facing the car:
 *  - front: the car's left side is on the photo's right;
 *  - back: the car's left side is on the photo's left;
 *  - left side: the front of the car is on the photo's left;
 *  - right side: the front of the car is on the photo's right.
 */
export function photoPointToDiagram(view: View, px: number, py: number): { x: number; y: number } {
  const v = clamp(py, 0, 1);
  switch (view) {
    case "front":
      return { x: clamp(1 - px, 0.2, 0.8), y: clamp(0.06 + v * 0.12) };
    case "back":
      return { x: clamp(px, 0.2, 0.8), y: clamp(0.82 + v * 0.12) };
    case "left":
      return { x: 0.16, y: clamp(0.12 + px * 0.76) };
    case "right":
      return { x: 0.84, y: clamp(0.12 + (1 - px) * 0.76) };
    case "wheels":
      return { x: px < 0.5 ? 0.14 : 0.86, y: py < 0.5 ? 0.27 : 0.73 };
    case "roof":
      return { x: clamp(0.35 + px * 0.3), y: clamp(0.35 + py * 0.3) };
    case "interior":
      return { x: clamp(0.35 + px * 0.3), y: clamp(0.3 + py * 0.25) };
    case "trunk":
      return { x: clamp(0.35 + px * 0.3), y: clamp(0.78 + py * 0.1) };
  }
}

/** Same spot on the drawing (≈ 7 % of its size) = the same damage. */
const NEAR = 0.07;

/**
 * Damages of the return that were not there at departure: no departure damage
 * close by. Unconfirmed AI suggestions are not counted yet.
 */
export function newDamages(departure: Damage[], ret: Damage[]): Damage[] {
  return ret.filter((d) => d.confirmed && !departure.some((o) => o.confirmed && Math.hypot(o.x - d.x, o.y - d.y) < NEAR));
}

/** Which required views still miss a photo. */
export function missingViews(photoViews: Iterable<string>): View[] {
  const have = new Set(photoViews);
  return REQUIRED_VIEWS.filter((v) => !have.has(v));
}

const NAME_HINTS: Array<[View, RegExp]> = [
  ["interior", /int[eé]rieur|interior|inside|dakhil|داخل/i],
  ["trunk", /coffre|trunk|boot|sendouk|صندوق/i],
  ["wheels", /roue|wheel|pneu|tyre|tire|jante|عجل/i],
  ["roof", /toit|roof|سقف/i],
  ["front", /avant|front|devant|أمام/i],
  ["back", /arri[eè]re|back|rear|خلف/i],
  ["left", /gauche|left|يسار/i],
  ["right", /droit|right|يمين/i],
];

/** A photo file named "avant.jpg", "3-left.jpg", "roue AV.jpg"… → its view (null: unknown). */
export function viewFromName(name: string): View | null {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  return NAME_HINTS.find(([, re]) => re.test(base))?.[0] ?? null;
}

/**
 * Several photos chosen at once: a file whose name says its side goes there; the
 * others fill the still-empty sides in order (front, back, left, right…).
 */
export function planPhotoImport<T extends { name: string }>(files: T[], filled: Iterable<View>): Array<[T, View]> {
  const taken = new Set<View>(filled);
  const plan: Array<[T, View]> = [];
  const rest: T[] = [];
  for (const f of files) {
    const v = viewFromName(f.name);
    if (v && !plan.some(([, pv]) => pv === v)) {
      plan.push([f, v]);
      taken.add(v);
    } else rest.push(f);
  }
  const empty = VIEWS.filter((v) => !taken.has(v));
  rest.slice(0, empty.length).forEach((f, i) => plan.push([f, empty[i]]));
  return plan;
}
