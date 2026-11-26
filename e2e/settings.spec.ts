import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addMember, admin, createTestAgency, expectNoHorizontalScroll, login } from "./helpers";

test("admin: agency name, logo, legal numbers, contract lists and alerts are saved", async ({ page }, testInfo) => {
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.goto("/settings");
  const form = page.getByTestId("settings-agency");
  // Typing before the page is interactive can append to the old name: retry until the field holds exactly the new one
  const name = form.getByLabel("Nom de l'agence");
  await expect(async () => {
    await name.fill("Atlas Cars Test");
    await expect(name).toHaveValue("Atlas Cars Test", { timeout: 1000 });
  }).toPass();
  await form.getByLabel("Ville").fill("Marrakech");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées.").last()).toBeVisible();
  await expect(page.getByText("Atlas Cars Test", { exact: true }).filter({ visible: true }).first()).toBeVisible();

  const logo = testInfo.outputPath("logo.png");
  writeFileSync(logo, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await page.locator("#settings-logo").setInputFiles(logo);
  await expect(page.getByTestId("settings-logo-remove")).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Informations légales", exact: true }).click();
  const legal = page.getByTestId("settings-legal");
  await legal.getByLabel("ICE").fill("123");
  await legal.getByRole("button", { name: "Enregistrer" }).click();
  await expect(legal.getByText("L'ICE contient 15 chiffres.")).toBeVisible();
  await legal.getByLabel("ICE").fill("001234567000089");
  await legal.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées.").last()).toBeVisible();

  await page.getByRole("link", { name: "Contrat", exact: true }).click();
  const contract = page.getByTestId("settings-contract");
  await contract.getByLabel("Nouvel élément pour « Équipements à cocher au départ »").fill("Chargeur USB");
  await contract.getByRole("button", { name: "Ajouter" }).first().click();
  await contract.getByRole("button", { name: "Retirer « Extincteur »" }).click();
  await contract.getByLabel("Âge minimum du conducteur").fill("23");
  await contract.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées.").last()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Alertes", exact: true }).click();
  await page.getByRole("radio", { name: /Administrateurs et employés/ }).click();
  await page.getByTestId("settings-alerts").getByRole("button", { name: "Enregistrer" }).click();
  await expect
    .poll(async () => (await admin().from("agencies").select("alert_roles").eq("id", agency.agencyId).single()).data?.alert_roles)
    .toEqual(["admin", "staff"]);

  const { data } = await admin().from("agencies").select("name, city, logo_path, ice, equipment_items, min_driver_age, alert_roles").eq("id", agency.agencyId).single();
  expect(data).toMatchObject({ name: "Atlas Cars Test", city: "Marrakech", ice: "001234567000089", min_driver_age: 23, alert_roles: ["admin", "staff"] });
  expect(data?.logo_path).toMatch(new RegExp(`^${agency.agencyId}/logo-`));
  expect(data?.equipment_items).toContain("Chargeur USB");
  expect(data?.equipment_items).not.toContain("Extincteur");
  const { data: log } = await admin().from("activity_log").select("details").eq("agency_id", agency.agencyId).eq("action", "settings.update");
  expect(log?.length).toBeGreaterThanOrEqual(4);
});

test("staff only see Affichage, and cannot export", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  await login(page, staff.email, staff.password);
  await page.goto("/settings?section=agency");
  await expect(page.getByRole("heading", { name: "Affichage" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agence", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("settings-agency")).toHaveCount(0);
  expect((await page.request.get("/api/export")).status()).toBe(403);
  await expectNoHorizontalScroll(page);
});

test("admin: export everything, then delete the agency by typing its name", async ({ page }) => {
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  const res = await page.request.get("/api/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml");

  await page.goto("/settings?section=data");
  await page.getByRole("button", { name: "Supprimer l'agence" }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Supprimer définitivement" });
  await dialog.getByRole("textbox").fill("autre nom");
  await expect(confirm).toBeDisabled();
  const { data: a } = await admin().from("agencies").select("name").eq("id", agency.agencyId).single();
  await dialog.getByRole("textbox").fill(a!.name);
  await confirm.click();
  await page.waitForURL(/select-agency/);
  const { count } = await admin().from("agencies").select("id", { count: "exact", head: true }).eq("id", agency.agencyId);
  expect(count).toBe(0);
});
