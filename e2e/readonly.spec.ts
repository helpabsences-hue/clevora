import { expect, test } from "@playwright/test";
import { createTestAgency, expectNoHorizontalScroll, login } from "./helpers";

test("when the trial is over the app is read-only, with a clear banner", async ({ page }) => {
  const agency = await createTestAgency({ trialEnded: true });
  await login(page, agency.email, agency.password);
  const banner = page.getByTestId("readonly-banner");
  await expect(banner).toContainText("Votre essai gratuit est terminé.");
  await expect(banner).toContainText("Vos données sont conservées");
  await expect(banner.getByRole("link", { name: "Choisir un forfait" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/team");
  await expect(page.getByRole("button", { name: "Inviter" })).toBeDisabled();
});
