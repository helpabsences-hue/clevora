import { expect, test } from "@playwright/test";
import { admin, createTestAgency, DEMO, login } from "./helpers";

test("a user of agency A never sees agency B, even when forcing the agency cookie", async ({ page, context, baseURL }) => {
  // Agency B with 3 cars
  const b = await createTestAgency();
  await admin()
    .from("vehicles")
    .insert(
      [1, 2, 3].map((n) => ({
        agency_id: b.agencyId,
        plate: `B${n}-${b.agencyId.slice(0, 6)}`,
        brand_model: "Voiture B",
        category: "economy",
        fuel: "diesel",
        gearbox: "manuelle",
        daily_rate: 200,
      })),
    );

  // A = Agence Démo (12 cars)
  await login(page, DEMO.admin.email, DEMO.admin.password);
  await expect(page.getByTestId("header-agency-name")).toHaveText(DEMO.agencyName);
  await expect(page.getByTestId("count-vehicles")).toHaveText("12");

  // Try to switch to B by forging the cookie: the server ignores it
  await context.addCookies([{ name: "parcolia_agency", value: b.agencyId, url: baseURL! }]);
  await page.goto("/dashboard");
  await expect(page.getByTestId("header-agency-name")).toHaveText(DEMO.agencyName);
  await expect(page.getByTestId("count-vehicles")).toHaveText("12");
  await expect(page.getByText(b.name)).toHaveCount(0);

  await page.goto("/team");
  await expect(page.getByTestId("member-list")).not.toContainText(b.email);
});

test("the admin of agency B only sees agency B", async ({ page }) => {
  const b = await createTestAgency();
  await login(page, b.email, b.password);
  await expect(page.getByTestId("header-agency-name")).toHaveText(b.name);
  await expect(page.getByTestId("count-vehicles")).toHaveText("0");
  await expect(page.getByText(DEMO.agencyName)).toHaveCount(0);
});
