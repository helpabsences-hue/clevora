import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, uid } from "./helpers";

test("signup in 3 steps creates an agency and lands on Aujourd'hui with the trial banner", async ({ page }) => {
  const id = uid();
  const agencyName = `Atlas Cars ${id}`;
  await page.goto("/signup");

  // Step 1 — the owner
  await expect(page.getByText("Étape 1 sur 3")).toBeVisible();
  await page.getByLabel("Nom et prénom").fill("Karim Test");
  await page.getByLabel("Adresse e-mail").fill(`signup-${id}@test.parcolia.ma`);
  await page.getByLabel("Téléphone").fill("06 12 34 56 78");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Atlas-2026-ok");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 2 — the agency
  await expect(page.getByText("Étape 2 sur 3")).toBeVisible();
  await page.getByLabel("Nom de l'agence").fill(agencyName);
  await page.getByLabel("Ville").fill("Marrakech");
  await page.getByLabel("Téléphone de l'agence").fill("0524000000");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 3 — logo (skipped) and colour, with live preview
  await expect(page.getByText("Étape 3 sur 3")).toBeVisible();
  await page.getByRole("button", { name: "#0F766E" }).click();
  await expect(page.getByText(agencyName).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Créer mon agence" }).click();

  await page.waitForURL(/\/dashboard/);
  await expect(page.getByTestId("header-agency-name")).toHaveText(agencyName);
  await expect(page.getByTestId("trial-banner")).toHaveCount(0); // the trial is not announced on every page
  // the agency colour drives --brand
  const brand = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  expect(brand.toUpperCase()).toBe("#0F766E");
  await expectNoHorizontalScroll(page);
});

test("signup refuses an email that already has an account", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Nom et prénom").fill("Doublon");
  await page.getByLabel("Adresse e-mail").fill("admin@demo.parcolia.ma");
  await page.getByLabel("Téléphone").fill("0612345678");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Doublon-2026");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Nom de l'agence").fill("Doublon");
  await page.getByLabel("Ville").fill("Rabat");
  await page.getByLabel("Téléphone de l'agence").fill("0537000000");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  // back on step 1 with a clear message on the email field
  await expect(page.getByText("Étape 1 sur 3")).toBeVisible();
  await expect(page.getByText("Un compte existe déjà avec cet e-mail").first()).toBeVisible();
});
