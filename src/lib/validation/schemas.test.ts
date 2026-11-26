import { describe, expect, it } from "vitest";
import { inviteSchema } from "@/app/[locale]/(app)/team/schema";
import { newPasswordSchema, signupSchema } from "@/app/[locale]/(auth)/schema";
import { safeNextPath } from "@/lib/auth/next-path";

const validSignup = {
  fullName: "Karim Alaoui",
  email: "  Karim@Example.MA ",
  phone: "06 12 34 56 78",
  password: "Atlas2026",
  agencyName: "Atlas Cars",
  city: "Marrakech",
  agencyPhone: "0524000000",
  brandColor: "#0F766E",
  locale: "fr",
};

describe("signupSchema", () => {
  it("normalises email and phones", () => {
    const out = signupSchema.parse(validSignup);
    expect(out.email).toBe("karim@example.ma");
    expect(out.phone).toBe("+212612345678");
    expect(out.agencyPhone).toBe("+212524000000");
  });
  it("returns translation keys as messages", () => {
    const res = signupSchema.safeParse({ ...validSignup, password: "abcdefgh", phone: "123", email: "x" });
    expect(res.success).toBe(false);
    const messages = Object.fromEntries((res.error?.issues ?? []).map((i) => [i.path[0], i.message]));
    expect(messages).toMatchObject({ password: "passwordLettersDigits", phone: "phone", email: "email" });
  });
});

describe("newPasswordSchema", () => {
  it("requires the confirmation to match", () => {
    const res = newPasswordSchema.safeParse({ password: "Atlas2026", confirm: "Atlas2027" });
    expect(res.error?.issues[0]).toMatchObject({ path: ["confirm"], message: "passwordsDontMatch" });
  });
});

describe("inviteSchema", () => {
  it("accepts email or WhatsApp invitations with a role", () => {
    expect(inviteSchema.parse({ channel: "email", email: "A@B.ma", role: "staff" })).toEqual({ channel: "email", email: "a@b.ma", role: "staff" });
    expect(inviteSchema.parse({ channel: "whatsapp", phone: "0661000000", role: "admin" })).toEqual({
      channel: "whatsapp",
      phone: "+212661000000",
      role: "admin",
    });
  });
  it("only knows the two roles", () => {
    expect(inviteSchema.safeParse({ channel: "email", email: "a@b.ma", role: "owner" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths only", () => {
    expect(safeNextPath("/team")).toBe("/team");
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
