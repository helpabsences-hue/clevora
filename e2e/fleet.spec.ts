import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, DEMO, expectNoHorizontalScroll, login, uid } from "./helpers";

test("an admin adds a car; every value is typed by the user", async ({ page }) => {
  const agency = await createTestAgency();
  const plate = `${Math.floor(10000 + Math.random() * 89999)}-B-6`;
  await login(page, agency.email, agency.password);
  await page.goto("/fleet");
  await expect(page.getByText("Aucune voiture pour le moment")).toBeVisible();
  await page.getByRole("link", { name: "Ajouter une voiture" }).first().click();
  await page.waitForURL(/\/fleet\/new/);

  await page.getByLabel("Matricule").fill(plate.toLowerCase());
  await expect(page.getByLabel("Matricule")).toHaveValue(plate);
  await page.getByLabel("Marque et modèle").fill("Hyundai Accent");
  await page.getByRole("radio", { name: "Compacte" }).click();
  await page.getByRole("radio", { name: "Diesel" }).click();
  await page.getByRole("radio", { name: "Automatique" }).click();
  await page.getByLabel("Prix par jour").fill("350");
  await page.getByLabel("Kilométrage actuel").fill("55000");
  await page.getByLabel("Fin de l'assurance").fill("2027-06-30");
  await page.getByLabel("Prochaine vidange (km)").fill("60000");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await page.waitForURL(/\/fleet\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Hyundai Accent" })).toBeVisible();
  await expect(page.getByTestId("vehicle-status").first()).toHaveText("Disponible");
  await expect(page.getByText("Dans 5 000 km")).toBeVisible();

  // No insurer / policy number asked here (that is on the Assurance page)
  await page.goto("/fleet/new");
  await expect(page.getByLabel(/assureur|police/i)).toHaveCount(0);
});

test("staff put a car in maintenance, see the reason and date, then put it back in service", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const plate = `M-${uid().slice(-6).toUpperCase()}`;
  await addVehicle(agency.agencyId, { plate, brand_model: "Peugeot 208" });

  await login(page, staff.email, staff.password);
  await page.goto("/fleet");
  const card = page.getByTestId("fleet-list").locator("li:visible, tr:visible").filter({ hasText: plate }).first();
  // Table rows keep their actions in a "⋯" menu; cards show the buttons.
  const rowAction = async (row: typeof card, name: string) => {
    const menu = row.getByTestId("vehicle-menu");
    if (await menu.isVisible()) {
      await menu.click();
      await page.getByRole("menuitem", { name }).click();
    } else {
      await row.getByRole("button", { name }).click();
    }
  };
  await rowAction(card, "Maintenance");

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Pneus" }).click();
  const until = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await dialog.getByLabel("Retour prévu").fill(until);
  await dialog.getByRole("button", { name: "Mettre en maintenance" }).click();
  await expect(page.getByText("Voiture mise en maintenance.")).toBeVisible();

  const [y, m, d] = until.split("-");
  await expect(card.getByTestId("vehicle-status")).toContainText("Maintenance");
  await expect(card.getByTestId("vehicle-status")).toContainText(`Pneus · jusqu'au ${d}/${m}`);
  await page.goto("/fleet?tab=maintenance");
  await expect(page.getByTestId("fleet-list")).toContainText(plate);
  expect(y).toBeTruthy();

  await rowAction(page.getByTestId("fleet-list").locator("li:visible, tr:visible").filter({ hasText: plate }).first(), "Remettre en service");
  await expect(page.getByText("La voiture est de nouveau disponible.")).toBeVisible();
  await page.goto("/fleet?tab=available");
  await expect(page.getByTestId("fleet-list")).toContainText(plate);
});

test("import updates existing plates instead of duplicating them", async ({ page }, testInfo) => {
  const agency = await createTestAgency();
  const existing = `IMP-${uid().slice(-5).toUpperCase()}`;
  const fresh = `NEW-${uid().slice(-5).toUpperCase()}`;
  await addVehicle(agency.agencyId, { plate: existing, brand_model: "Ancien modèle", daily_rate: 200 });

  const csv = testInfo.outputPath("parc.csv");
  writeFileSync(
    csv,
    [
      "Matricule;Modèle;Catégorie;Carburant;Boîte;Prix/jour;Km;Fin assurance",
      // same plate written differently (spaces, lower case) => update
      `${existing.toLowerCase().replace("-", " ")};Dacia Duster;SUV;Diesel;Manuelle;333;61000;31/12/2027`,
      `${fresh};Kia Picanto;Économique;Essence;Manuelle;220;15000;30/06/2027`,
      `;Sans matricule;SUV;Diesel;Manuelle;400;0;`,
    ].join("\n"),
  );

  await login(page, agency.email, agency.password);
  await page.goto("/fleet");
  await page.getByRole("button", { name: "Importer" }).click();
  await page.getByTestId("import-file").setInputFiles(csv);
  const preview = page.getByTestId("import-preview");
  await expect(preview).toContainText("matricule manquant");
  await expect(preview.locator("li").filter({ hasText: "Dacia Duster" })).toContainText("Mise à jour");
  await expect(preview.locator("li").filter({ hasText: "Kia Picanto" })).toContainText("Nouvelle");
  await page.getByRole("button", { name: "Importer 2 voitures" }).click();
  await expect(page.getByTestId("import-result")).toContainText("1 voiture ajoutée, 1 mise à jour.");

  const { data: cars } = await admin().from("vehicles").select("plate, brand_model, daily_rate").eq("agency_id", agency.agencyId).order("plate");
  expect(cars).toHaveLength(2);
  expect(cars!.find((c) => c.brand_model === "Dacia Duster")).toMatchObject({ daily_rate: 333 });
});

test("filters, search and staff limits on the demo fleet", async ({ page }) => {
  await login(page, DEMO.staff.email, DEMO.staff.password);
  await page.goto("/fleet");
  await expect(page.getByRole("link", { name: "Ajouter une voiture" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Importer" })).toHaveCount(0);

  await page.getByRole("link", { name: /^Maintenance/ }).click();
  await expect(page.getByTestId("fleet-list")).toContainText("Renault Kangoo");
  await expect(page.getByTestId("fleet-list")).not.toContainText("Dacia Logan");

  await page.goto("/fleet");
  await page.waitForLoadState("networkidle"); // typing before the page is ready would be lost
  await page.getByRole("searchbox").fill("12345 a");
  await expect(page).toHaveURL(/q=12345/);
  await expect(page.getByTestId("fleet-list")).toContainText("Dacia Logan");
  await expect(page.getByTestId("fleet-list")).not.toContainText("Peugeot 3008");
  await expectNoHorizontalScroll(page);

  await page.goto("/fleet/new");
  await page.waitForURL(/\/dashboard/);
});
