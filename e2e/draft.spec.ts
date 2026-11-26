import { expect, test } from "@playwright/test";
import { createTestAgency, login } from "./helpers";

test("reservation draft: kept on the device after a reload, offered back, cleared on demand", async ({ page }) => {
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.goto("/reservations/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("N° de contrat").fill("BROUILLON-7");
  await page.waitForTimeout(1200); // the draft is saved a moment after typing

  await page.reload();
  const banner = page.getByTestId("draft-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Reprendre" }).click();
  await expect(page.getByLabel("N° de contrat")).toHaveValue("BROUILLON-7");
  await expect(banner).toHaveCount(0);

  await page.reload();
  await page.getByTestId("draft-banner").getByRole("button", { name: "Effacer" }).click();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("draft-banner")).toHaveCount(0);
});
