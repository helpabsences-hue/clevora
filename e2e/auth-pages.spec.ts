import { expect, test } from "@playwright/test";
import { DEMO, expectNoHorizontalScroll, latestEmailHtml, login } from "./helpers";

test("auth pages fit every screen in French and Arabic (RTL)", async ({ page }) => {
  for (const path of ["/login", "/signup", "/forgot-password", "/ar/login", "/ar/signup", "/en/login"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
  await page.goto("/ar/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
});

test("wrong password shows a clear message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(DEMO.admin.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mot-de-passe-1");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
});

test("forgot password sends a Parcolia email with a working reset link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one run is enough (shared demo account)");
  await page.goto("/forgot-password");
  await page.getByLabel("Adresse e-mail").fill(DEMO.staff.email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText("un lien vient d'être envoyé")).toBeVisible();

  const html = await latestEmailHtml(DEMO.staff.email);
  expect(html).toContain("Parcolia");
  const link = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
  expect(link).toContain("type=recovery");
  await page.goto(link!);
  await page.waitForURL(/\/reset-password/);
  // Same password as before so the shared demo account keeps working
  await page.getByLabel("Nouveau mot de passe").fill(DEMO.staff.password);
  await page.getByLabel("Confirmer le mot de passe").fill(DEMO.staff.password);
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  // Supabase refuses re-using the same password, which proves the session works
  await expect(page.getByText("différent de l'ancien")).toBeVisible();
});

test("login redirects to the page that was asked for", async ({ page }) => {
  await page.goto("/account");
  await page.waitForURL(/\/login\?next=%2Faccount/);
  await page.getByLabel("Adresse e-mail").fill(DEMO.staff.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(DEMO.staff.password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/account/);
  await expect(page.getByRole("heading", { name: "Mon compte" })).toBeVisible();
});

test("logged-in users are sent from /login to the app", async ({ page }) => {
  await login(page, DEMO.staff.email, DEMO.staff.password);
  await page.goto("/login");
  await page.waitForURL(/\/dashboard/);
});
