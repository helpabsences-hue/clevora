/** Agency brand colour → CSS variables, with an AA contrast check. */

/** Dark navy used when the agency colour is missing or too light for white text. */
export const FALLBACK_BRAND = "#1E2A4A";
export const BRAND_FOREGROUND = "#FFFFFF";
/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5;

const HEX = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ResolvedBrand = {
  brand: string;
  foreground: string;
  usedFallback: boolean;
};

/** Returns the colour to use for --brand (white text must stay readable on it). */
export function resolveBrandColor(input: string | null | undefined): ResolvedBrand {
  if (isHexColor(input) && contrastRatio(input, BRAND_FOREGROUND) >= MIN_CONTRAST) {
    return { brand: input.toUpperCase(), foreground: BRAND_FOREGROUND, usedFallback: false };
  }
  return { brand: FALLBACK_BRAND, foreground: BRAND_FOREGROUND, usedFallback: true };
}

/** Suggested colours for the signup / settings colour picker (all pass AA with white). */
export const BRAND_PRESETS = [
  "#1E2A4A",
  "#0F4C81",
  "#1D4ED8",
  "#0F766E",
  "#15803D",
  "#B91C1C",
  "#C2410C",
  "#7E22CE",
  "#BE185D",
  "#374151",
] as const;
