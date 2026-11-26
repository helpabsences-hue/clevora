import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createTestAgency, login } from "./helpers";

/** RFC 6238 code, like an authenticator app. */
function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
}

test("two-step login: turn it on, then the code is asked after the password", async ({ page, browser }) => {
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.goto("/account");
  const card = page.getByTestId("mfa-card");
  await card.getByRole("button", { name: "Activer" }).click();
  const secret = (await card.getByTestId("mfa-secret").innerText()).trim();
  await card.getByLabel("Code à 6 chiffres").fill("000000");
  await card.getByRole("button", { name: "Confirmer" }).click();
  await expect(card.getByText("Code incorrect")).toBeVisible();
  await card.getByLabel("Code à 6 chiffres").fill(totp(secret));
  await card.getByRole("button", { name: "Confirmer" }).click();
  await expect(card.getByText(/Activée/)).toBeVisible();

  // A new login: password, then the code
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.goto("/login");
  await p2.getByLabel("Adresse e-mail").fill(agency.email);
  await p2.getByLabel("Mot de passe", { exact: true }).fill(agency.password);
  await p2.getByRole("button", { name: "Se connecter", exact: true }).click();
  await p2.waitForURL(/\/mfa/);
  // Trying to open a page without the code goes back to the code
  await p2.goto("/fleet");
  await p2.waitForURL(/\/mfa/);
  await p2.getByLabel("Code à 6 chiffres").fill("123456");
  await p2.getByRole("button", { name: "Valider" }).click();
  await expect(p2.getByText("Code incorrect")).toBeVisible();
  // A code is only accepted once: use the next 30-second window's code if needed.
  await p2.getByLabel("Code à 6 chiffres").fill(totp(secret, Date.now() + 30_000));
  await p2.getByRole("button", { name: "Valider" }).click();
  const ok = await p2.waitForURL(/\/fleet|\/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);
  if (!ok) {
    await p2.waitForTimeout(31_000);
    await p2.getByLabel("Code à 6 chiffres").fill(totp(secret));
    await p2.getByRole("button", { name: "Valider" }).click();
  }
  await p2.waitForURL(/\/fleet|\/dashboard/);
  await ctx.close();
});
