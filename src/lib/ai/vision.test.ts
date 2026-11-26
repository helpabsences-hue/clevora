import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { parseFindings, visionPrompt } = await import("./vision");

describe("vision", () => {
  it("reads the JSON answer, keeps confident findings, fixes bad values", () => {
    const text = 'Voici : {"damages":[{"type":"dent","x":0.3,"y":0.7,"description":"Bosse","confidence":0.9},{"type":"boom","x":"0.5","y":2,"description":"?","confidence":0.6},{"type":"scratch","x":0.1,"y":0.1,"description":"Peut-être","confidence":0.2}]}';
    expect(parseFindings(text)).toEqual([
      { type: "dent", x: 0.3, y: 0.7, description: "Bosse", confidence: 0.9 },
      { type: "other", x: 0.5, y: 0.5, description: "?", confidence: 0.6 },
    ]);
  });
  it("no JSON or broken JSON: nothing", () => {
    expect(parseFindings("Je ne vois rien")).toEqual([]);
    expect(parseFindings("{damages: [")).toEqual([]);
    expect(parseFindings('{"damages":[]}')).toEqual([]);
  });
  it("the prompt names the view and asks for new damage only", () => {
    expect(visionPrompt("right")).toContain("le côté droit");
    expect(visionPrompt("front")).toMatch(/n'existent PAS/);
  });
});
