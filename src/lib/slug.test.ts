import { describe, expect, it } from "vitest";
import { slugify, withSuffix } from "./slug";

describe("slugify", () => {
  it("removes accents, spaces and symbols", () => {
    expect(slugify("Agence Démo")).toBe("agence-demo");
    expect(slugify("  Atlas Cars & Co. — Marrakech ")).toBe("atlas-cars-co-marrakech");
  });
  it("still returns a valid slug for Arabic or very short names", () => {
    expect(slugify("وكالة الأطلس")).toBe("agence");
    expect(slugify("AB")).toBe("agence-ab");
  });
  it("matches the database rule", () => {
    for (const name of ["Agence Démo", "Été 2026 !!", "x", "وكالة", "a".repeat(200)]) {
      const slug = slugify(name);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(slug.length).toBeGreaterThanOrEqual(3);
      expect(slug.length).toBeLessThanOrEqual(60);
    }
  });
  it("adds a short suffix when taken", () => {
    expect(withSuffix("agence-demo", () => 0.5)).toMatch(/^agence-demo-[a-z0-9]{4}$/);
  });
});
