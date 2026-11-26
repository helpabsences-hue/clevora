import { expect, test } from "@playwright/test";
import { addMember, admin, createPlatformAdmin, createTestAgency, expectNoHorizontalScroll, login } from "./helpers";

test("marketing home: hero, features and the three plans from the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Votre agence de location, simplement.");
  await expect(page.getByTestId("marketing-plans").getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) })).toHaveCount(3);
  await expect(page.getByTestId("marketing-plans")).toContainText("599 MAD");
  await expectNoHorizontalScroll(page);
  // The Parcolia logo is on the page, and the calls to action look like real buttons
  await expect(page.getByRole("img", { name: "Parcolia" }).first()).toBeVisible();
  const cta = page.getByRole("link", { name: "Essayer gratuitement 14 jours" }).first();
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await cta.click();
  await page.waitForURL(/\/signup/);
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoHorizontalScroll(page);
});

test("billing: admin asks for a plan, Parcolia confirms it, the invoice PDF is ready", async ({ page, browser }) => {
  const agency = await createTestAgency({ trialEnded: true });
  await login(page, agency.email, agency.password);
  await page.goto("/billing");
  await expect(page.getByText("Votre agence est en lecture seule")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("radio", { name: /Annuel/ }).click();
  await page.getByTestId("plan-pro").getByRole("button", { name: "Choisir Pro" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Valider ma demande" }).click();
  await expect(page.getByTestId("billing-pending")).toBeVisible();
  const reference = (await page.getByTestId("billing-reference").innerText()).trim();
  expect(reference).toMatch(/^PAR-[0-9A-F]{8}$/);
  await expect(page.getByTestId("billing-pending")).toContainText("5 990 MAD");

  // Parcolia staff confirm the transfer in /platform
  const staff = await createPlatformAdmin();
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.goto("/login");
  await p2.getByLabel("Adresse e-mail").fill(staff.email);
  await p2.getByLabel("Mot de passe", { exact: true }).fill(staff.password);
  await p2.getByRole("button", { name: "Se connecter", exact: true }).click();
  await p2.waitForURL(/\/platform/);
  const row = p2.getByTestId("platform-pending").getByRole("listitem").filter({ hasText: reference });
  await row.getByRole("button", { name: "Paiement reçu" }).click();
  await p2.getByRole("dialog").getByRole("button", { name: "Paiement reçu" }).click();
  await expect(p2.getByText(/Paiement validé\. Facture F-\d{4}-\d{5}/)).toBeVisible();
  await expectNoHorizontalScroll(p2);
  await ctx.close();

  await page.reload();
  await expect(page.getByTestId("billing-status")).toContainText("Abonnement payé jusqu'au");
  await expect(page.getByText("Votre agence est en lecture seule")).toHaveCount(0);
  const { data: pay } = await admin().from("subscription_payments").select("id").eq("reference", reference).single();
  const pdf = await page.request.get(`/api/invoices/${pay!.id}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});

test("billing and /platform are closed to the wrong people", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  await login(page, staff.email, staff.password);
  await page.goto("/billing");
  await page.waitForURL(/\/dashboard/);
  const res = await page.goto("/platform");
  expect(res?.status()).toBe(404);
});
