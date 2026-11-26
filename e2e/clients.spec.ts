import { expect, test } from "@playwright/test";
import { addMember, createTestAgency, expectNoHorizontalScroll, login } from "./helpers";

const SPECIMEN = "e2e/fixtures/cin-back-specimen.jpg"; // fake card: ALAMI Salma, TE778899

test("clients: add one by scanning the CIN, find it, book for it in one tap; the same CIN cannot be saved twice", async ({ page }) => {
  test.setTimeout(120_000);
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  await login(page, staff.email, staff.password);

  await page.goto("/clients");
  await expect(page.getByText("Aucun client pour l'instant")).toBeVisible();
  await page.getByRole("link", { name: "Ajouter un client" }).first().click();
  await page.waitForURL(/\/clients\/new/);

  // Scan the back of the CIN: read on the device
  await page.getByTestId("scan-id").click();
  await page.getByTestId("scan-file").setInputFiles(SPECIMEN);
  const result = page.getByTestId("scan-result");
  await expect(result).toBeVisible({ timeout: 60_000 });
  await expect(result).toContainText("ALAMI Salma");
  await expect(result).toContainText("TE778899");
  await page.getByTestId("scan-use").click();
  await expect(page.getByLabel("Numéro de CIN")).toHaveValue("TE778899");
  await expect(page.getByLabel("Nom et prénom")).toHaveValue("ALAMI Salma");
  await expect(page.getByLabel("Date de naissance")).toHaveValue("1988-07-22");
  await page.getByLabel("Téléphone").fill("0661112233");
  await page.getByLabel("N° de permis").fill("P-55667");
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ALAMI Salma");
  await expectNoHorizontalScroll(page);

  // From the client card: the reservation starts with the client filled in
  await page.locator('main a[href*="/reservations/new?client="]').click();
  await page.waitForURL(/\/reservations\/new\?client=/);
  await page.getByRole("radio", { name: /Plus tard/ }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.locator("#driver1-id_number")).toHaveValue("TE778899");
  await expect(page.locator("#driver1-full_name")).toHaveValue("ALAMI Salma");
  await expect(page.locator("#driver1-license_number")).toHaveValue("P-55667");

  // The list finds her by phone; a second card with the same CIN is refused
  await page.goto("/clients?q=0661112233");
  await expect(page.getByTestId("client-row").filter({ visible: true })).toHaveCount(1);
  await page.goto("/clients/new");
  await page.getByLabel("Numéro de CIN").fill("te-778899");
  await page.getByLabel("Nom et prénom").fill("Doublon Test");
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await expect(page.getByTestId("client-exists")).toBeVisible();
});
