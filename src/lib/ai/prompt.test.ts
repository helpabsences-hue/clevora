import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

describe("assistant prompt", () => {
  it("tells the model staff cannot see money", () => {
    const staff = buildSystemPrompt({ agencyName: "Atlas", role: "staff", today: "2026-11-09", weekday: "lundi", locale: "fr" });
    expect(staff).toContain("Atlas");
    expect(staff).toContain("seuls les administrateurs");
    const admin = buildSystemPrompt({ agencyName: "Atlas", role: "admin", today: "2026-11-09", weekday: "lundi", locale: "ar" });
    expect(admin).not.toContain("seuls les administrateurs");
    expect(admin).toContain("arabe");
  });

  it("sends earlier turns as quoted text inside the user message", () => {
    expect(buildUserMessage([], "  Bonjour ")).toBe("Bonjour");
    const msg = buildUserMessage(
      [
        { role: "user", text: "Qui revient demain ?" },
        { role: "assistant", text: "La Clio de M. Alami." },
      ],
      "Et après-demain ?",
    );
    expect(msg).toContain("<conversation_precedente>");
    expect(msg).toContain("Assistant : La Clio de M. Alami.");
    expect(msg.endsWith("Nouvelle question : Et après-demain ?")).toBe(true);
  });

  it("puts the agency data block first, then the conversation, then the question", () => {
    const msg = buildUserMessage([{ role: "user", text: "Bonjour" }], "Combien de voitures ?", "<donnees_agence>Parc : 12 voitures</donnees_agence>");
    expect(msg.indexOf("<donnees_agence>")).toBe(0);
    expect(msg.indexOf("<conversation_precedente>")).toBeGreaterThan(msg.indexOf("</donnees_agence>"));
    expect(msg.endsWith("Nouvelle question : Combien de voitures ?")).toBe(true);
  });

  it("keeps only the last turns and cuts long ones", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, text: `q${i} ${"x".repeat(3000)}` }));
    const msg = buildUserMessage(history, "ok");
    expect(msg).not.toContain("q11 ");
    expect(msg).toContain("q12 ");
    expect(msg.length).toBeLessThan(8 * 1600 + 200);
  });
});
