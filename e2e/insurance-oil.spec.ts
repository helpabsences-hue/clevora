import { expect, test } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, DEMO, expectNoHorizontalScroll, latestEmailHtml, login, uid } from "./helpers";

test("insurance: grouped by urgency; +1 an only prefills, then saving moves the car to OK", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const plate = `AS${uid().slice(-4).toUpperCase()}-A-6`;
  const id = await addVehicle(agency.agencyId, { plate, brand_model: "Kia Rio" });
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await admin().from("vehicles").update({ insurance_expires_on: yesterday, technical_visit_expires_on: "2099-01-01" }).eq("id", id);

  await login(page, staff.email, staff.password);
  await page.goto("/insurance");
  const expired = page.locator("[data-group='expired']:visible");
  await expect(expired).toContainText("Kia Rio");
  await expect(expired).toContainText("Expirée");
  await expectNoHorizontalScroll(page);

  await expired.getByRole("button", { name: "Modifier" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "+1 an" }).first().click();
  const filled = await dialog.getByLabel("Fin de l'assurance").inputValue();
  expect(filled > yesterday).toBe(true);
  await dialog.getByLabel("Assureur (facultatif)").fill("Wafa Assurance");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
  await expect(page.locator("[data-group='later']:visible")).toContainText("Kia Rio");
});

test("a car with expired insurance is not offered for booking, and the wizard says why", async ({ page }) => {
  await login(page, DEMO.staff.email, DEMO.staff.password);
  await page.goto("/reservations/new");
  await expect(page.getByTestId("unavailable-note")).toContainText("avec une assurance qui finit avant le retour");
  await expect(page.getByTestId("available-cars")).not.toContainText("Kia Picanto");
});

test("vidange: the last interval is only a suggestion; saving updates km left", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const id = await addVehicle(agency.agencyId, { plate: `VD${uid().slice(-4).toUpperCase()}-A-6`, brand_model: "Fiat Tipo" });
  await admin().from("vehicles").update({ current_km: 40000, oil_last_km: 30500, oil_next_km: 40500 }).eq("id", id);

  await login(page, staff.email, staff.password);
  await page.goto("/oil");
  const row = page.getByTestId("oil-row").filter({ hasText: "Fiat Tipo", visible: true });
  await expect(page.locator("[data-group='soon']:visible")).toContainText("Fiat Tipo");
  await expect(row.getByTestId("oil-km-left")).toHaveText("Dans 500 km");

  await row.getByRole("button", { name: "Vidange faite" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Prochaine vidange (km)")).toHaveValue("");
  await expect(dialog.getByTestId("oil-prices")).toHaveCount(0); // staff never record money
  await expect(dialog.getByRole("button", { name: "Huile moteur" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: /Même intervalle que la dernière fois/ }).click();
  await expect(dialog.getByLabel("Prochaine vidange (km)")).toHaveValue("50000");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Vidange enregistrée.")).toBeVisible();
  await expect(page.locator("[data-group='ok']:visible")).toContainText("Fiat Tipo");
  await expect(page.getByTestId("oil-row").filter({ hasText: "Fiat Tipo", visible: true }).getByTestId("oil-km-left")).toHaveText("Dans 10 000 km");
  await expect(page.getByTestId("oil-row").filter({ hasText: "Fiat Tipo", visible: true }).getByTestId("oil-last-items")).toHaveText("Huile moteur, Filtre à huile");
});

test("vidange by an admin: several parts become ONE Vidange charge with the details", async ({ page }) => {
  const agency = await createTestAgency();
  const id = await addVehicle(agency.agencyId, { plate: `VC${uid().slice(-4).toUpperCase()}-A-6`, brand_model: "Renault Clio" });
  await admin().from("vehicles").update({ current_km: 60000, oil_last_km: 50000, oil_next_km: 60000 }).eq("id", id);

  await login(page, agency.email, agency.password);
  await page.goto("/oil");
  await page.getByTestId("oil-row").filter({ hasText: "Renault Clio", visible: true }).getByRole("button", { name: "Vidange faite" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Prochaine vidange (km)").fill("70000");
  await dialog.getByRole("button", { name: "Filtre à air" }).click();
  await dialog.getByRole("button", { name: "Courroie / chaîne" }).click();
  await dialog.getByRole("button", { name: "Courroie / chaîne" }).click(); // unselect
  const prices = dialog.getByTestId("oil-prices");
  await prices.getByLabel("Huile moteur").fill("300");
  await prices.getByLabel("Filtre à huile").fill("80");
  await prices.getByLabel("Filtre à air").fill("120");
  await expect(dialog.getByTestId("oil-total")).toContainText("500 MAD");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Vidange enregistrée.")).toBeVisible();

  const { data: charges } = await admin().from("charges").select("category, amount, note").eq("vehicle_id", id);
  expect(charges).toEqual([{ category: "vidange", amount: 500, note: "Vidange à 60 000 km · Huile moteur, Filtre à huile, Filtre à air" }]);
  const { data: hist } = await admin().from("oil_changes").select("km, next_km, items").eq("vehicle_id", id);
  expect(hist).toEqual([{ km: 60000, next_km: 70000, items: ["huile", "filtre_huile", "filtre_air"] }]);

  // "Vidange" is no longer a category you pick by hand in Charges
  await page.goto("/charges");
  await page.getByRole("button", { name: /Ajouter une charge/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("radio", { name: "Vidange" })).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("radio", { name: "Carburant" })).toBeVisible();
});

test("daily alert email: protected by a secret, sent to admins, in their language", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one run is enough");
  expect((await request.get("/api/cron/daily-alerts")).status()).toBe(401);

  const { data: agency } = await admin().from("agencies").select("id").eq("slug", "agence-demo").single();
  const res = await request.get(`/api/cron/daily-alerts?agency=${agency!.id}&force=1`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.report[0].alerts).toBeGreaterThan(0);
  expect(body.report[0].sent).toBe(1); // alert_roles = admin only

  const html = await latestEmailHtml(DEMO.admin.email);
  expect(html).toContain("Agence Démo");
  expect(html).toContain("Kia Picanto");
  expect(html).toContain("Propulsé par Parcolia");

  // Already sent today: not sent twice
  const again = await request.get(`/api/cron/daily-alerts?agency=${agency!.id}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect((await again.json()).report[0].skipped).toBe("already_sent");
});
