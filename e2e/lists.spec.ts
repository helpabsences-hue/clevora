import { expect, test } from "@playwright/test";
import { addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

test("Assurance, Vidange and Charges: search at the top filters the table", async ({ page }) => {
  const agency = await createTestAgency();
  const a = `SR${uid().slice(-4).toUpperCase()}-A-6`;
  const b = `SR${uid().slice(-4).toUpperCase()}-B-6`;
  const carA = await addVehicle(agency.agencyId, { plate: a, brand_model: "Toyota Corolla" });
  await addVehicle(agency.agencyId, { plate: b, brand_model: "Seat Ibiza" });
  await admin().from("charges").insert([
    { agency_id: agency.agencyId, category: "lavage", amount: 70, vehicle_id: carA, note: "Lavage complet" },
    { agency_id: agency.agencyId, category: "loyer", amount: 5000, note: "Loyer bureau" },
  ]);
  await login(page, agency.email, agency.password);

  for (const path of ["/insurance", "/oil"]) {
    await page.goto(path);
    const search = page.getByRole("searchbox");
    await search.fill("corolla");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=corolla/);
    await expect(page.locator("main")).toContainText("Toyota Corolla");
    await expect(page.locator("main")).not.toContainText("Seat Ibiza");
    await expectNoHorizontalScroll(page);
  }

  await page.goto("/charges");
  await expect(page.getByTestId("charges-total")).toHaveText("5 070 MAD");
  const search = page.getByPlaceholder(/Catégorie, note/);
  await search.fill("loyer");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=loyer/);
  const rows = page.getByTestId("charge-row").filter({ visible: true });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("5 000 MAD");
  // The tiles keep the month totals, whatever the search
  await expect(page.getByTestId("charges-total")).toHaveText("5 070 MAD");
  await expectNoHorizontalScroll(page);
});
