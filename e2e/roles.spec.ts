import { expect, test } from "@playwright/test";
import { DEMO, expectNoHorizontalScroll, login, openUserMenu } from "./helpers";

test("staff cannot open /team and the menu does not offer it", async ({ page }) => {
  await login(page, DEMO.staff.email, DEMO.staff.password);
  await expect(page.getByTestId("header-agency-name")).toHaveText(DEMO.agencyName);
  // CLAUDE.md: the header shows the user's name with the role under it, at every size
  await expect(page.getByTestId("header-user-name")).toBeVisible();
  await expect(page.getByTestId("header-user-role")).toHaveText("Agent");

  await openUserMenu(page);
  await expect(page.getByRole("menuitem", { name: "Mon compte" })).toBeVisible();
  await expect(page.getByTestId("menu-team")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto("/team");
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText("Vous n'avez pas accès à cette page.")).toBeVisible();
  await expect(page.getByTestId("member-list")).toHaveCount(0);
});

test("admin can open /team and sees the members", async ({ page }) => {
  await login(page, DEMO.admin.email, DEMO.admin.password);
  await openUserMenu(page);
  await page.getByTestId("menu-team").click();
  await page.waitForURL(/\/team/);
  await expect(page.getByRole("heading", { name: "Équipe" })).toBeVisible();
  await expect(page.getByTestId("member-list")).toContainText("staff@demo.parcolia.ma");
  await expectNoHorizontalScroll(page);
});
