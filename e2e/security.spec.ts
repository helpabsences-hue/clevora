import { expect, test } from "@playwright/test";

test("security headers are sent on every page", async ({ request }) => {
  for (const path of ["/", "/login", "/api/assistant"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    const h = res.headers();
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"], path).toContain("object-src 'none'");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["strict-transport-security"], path).toContain("max-age=");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

test("login is rate limited per e-mail address", async ({ browser }) => {
  // A fake visitor address (not exempted like the test machine)
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}` } });
  const page = await ctx.newPage();
  const email = `nobody-${Date.now()}@test.parcolia.ma`;
  await page.goto("/login");
  let blocked = false;
  for (let i = 0; i < 10 && !blocked; i++) {
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill("Wrong-password-1");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    const msg = page.getByText(/Trop d'essais|incorrect/i).last();
    await expect(msg).toBeVisible();
    blocked = (await page.getByText("Trop d'essais").count()) > 0;
  }
  expect(blocked).toBe(true);
  await ctx.close();
});
