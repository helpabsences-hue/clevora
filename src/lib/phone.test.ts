import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, whatsappNumber } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["06 12 34 56 78", "+212612345678"],
    ["0612-345678", "+212612345678"],
    ["07.12.34.56.78", "+212712345678"],
    ["0522000000", "+212522000000"],
    ["00212612345678", "+212612345678"],
    ["212612345678", "+212612345678"],
    ["+212 6 12 34 56 78", "+212612345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "abc", "0612", "061234567890", "+212412345678", "+2126123"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone / whatsappNumber", () => {
  it("formats Moroccan numbers for reading", () => {
    expect(formatPhone("+212612345678")).toBe("+212 6 12 34 56 78");
    expect(formatPhone("+33612345678")).toBe("+33612345678");
    expect(formatPhone(null)).toBe("");
  });
  it("keeps digits only for wa.me", () => {
    expect(whatsappNumber("+212612345678")).toBe("212612345678");
  });
});
