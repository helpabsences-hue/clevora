import { expect, test } from "@playwright/test";
import { addVehicle, admin, createTestAgency, DEMO, expectNoHorizontalScroll, login, uid } from "./helpers";

test("Aujourd'hui: tiles, returns and departures by urgency, alerts that link to the fix", async ({ page }) => {
  await login(page, DEMO.admin.email, DEMO.admin.password);
  await expect(page.getByTestId("stat-on-rental")).toHaveText(/\d+/);
  await expect(page.getByTestId("stat-revenue")).toContainText("MAD");
  await expect(page.getByTestId("dash-returns").locator("[data-urgency='late']")).toBeVisible();
  await expect(page.getByTestId("dash-alerts")).toContainText("Assurance expirée : Kia Picanto");
  await expectNoHorizontalScroll(page);
  await page.getByTestId("dash-alerts").getByRole("link", { name: /Vidange à faire/ }).first().click();
  await page.waitForURL(/\/oil/);
});

test("staff do not see the revenue tile", async ({ page }) => {
  await login(page, DEMO.staff.email, DEMO.staff.password);
  await expect(page.getByTestId("stat-available")).toBeVisible();
  await expect(page.getByTestId("stat-revenue")).toHaveCount(0);
});

test("planning: bookings on the grid (or the day list on phones); an empty cell starts a booking for that car and day", async ({ page }, testInfo) => {
  const agency = await createTestAgency();
  const plate = `PL${uid().slice(-4).toUpperCase()}-A-6`;
  const vehicleId = await addVehicle(agency.agencyId, { plate, brand_model: "Renault Clio" });
  const { data: client } = await admin().from("clients").insert({ agency_id: agency.agencyId, full_name: "Client Planning", id_type: "cin", id_number: `PL${uid().slice(-6)}` }).select("id").single();
  await admin().from("reservations").insert({
    agency_id: agency.agencyId,
    vehicle_id: vehicleId,
    client_id: client!.id,
    start_at: new Date(Date.now() + 3_600_000).toISOString(),
    end_at: new Date(Date.now() + 26 * 3_600_000).toISOString(),
    daily_price: 300,
    delivery: true,
    delivery_place: "Gare",
  });

  await login(page, agency.email, agency.password);
  await page.goto("/planning");
  await expectNoHorizontalScroll(page);
  if (testInfo.project.name === "phone") {
    await expect(page.getByTestId("planning-day")).toContainText("Client Planning");
    await expect(page.getByTestId("planning-grid")).toBeHidden();
  } else {
    await expect(page.getByTestId("planning-booking").filter({ hasText: "Client Planning" })).toBeVisible();
    // next week is empty: tap a cell to book
    await page.getByRole("link", { name: "Semaine suivante" }).click();
    await page.waitForURL(/week=/);
    const week = new URL(page.url()).searchParams.get("week")!;
    await page.getByRole("link", { name: `Réserver Renault Clio ${plate} le ${week}` }).click();
    await page.waitForURL(/\/reservations\/new\?vehicle=/);
    await expect(page.getByTestId("available-cars").getByRole("radio", { name: /Renault Clio/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Date de départ")).toHaveValue(week);
  }
});
