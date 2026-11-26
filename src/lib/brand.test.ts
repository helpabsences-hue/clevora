import { describe, expect, it } from "vitest";
import { BRAND_PRESETS, contrastRatio, FALLBACK_BRAND, resolveBrandColor } from "./brand";

describe("resolveBrandColor", () => {
  it("keeps a dark colour that is readable with white text", () => {
    expect(resolveBrandColor("#0f766e")).toEqual({ brand: "#0F766E", foreground: "#FFFFFF", usedFallback: false });
  });

  it("falls back to dark navy when the colour is too light", () => {
    for (const light of ["#FFFFFF", "#FDE047", "#A7F3D0", "#9CA3AF"]) {
      expect(resolveBrandColor(light)).toEqual({ brand: FALLBACK_BRAND, foreground: "#FFFFFF", usedFallback: true });
    }
  });

  it("falls back when the colour is missing or invalid", () => {
    expect(resolveBrandColor(null).usedFallback).toBe(true);
    expect(resolveBrandColor("red").usedFallback).toBe(true);
    expect(resolveBrandColor("#12345").usedFallback).toBe(true);
    expect(resolveBrandColor("#1E2A4A;}body{display:none").usedFallback).toBe(true);
  });

  it("every preset passes WCAG AA (4.5:1) with white text", () => {
    for (const color of BRAND_PRESETS) {
      expect(contrastRatio(color, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(resolveBrandColor(color).usedFallback).toBe(false);
    }
  });

  it("computes known contrast ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
});
