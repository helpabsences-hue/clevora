import { expect, test } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

test("activity log: admins see who did what; staff cannot open it", async ({ page, browser }) => {
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.goto("/fleet/new");
  // A real action through the app, so the log has a named actor
  await page.goto("/settings?section=alerts");
  await page.getByTestId("settings-alerts").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées.").last()).toBeVisible();

  await page.goto("/activity");
  await expect(page.getByRole("heading", { name: "Journal d'activité", level: 1 })).toBeVisible();
  await expect(page.getByTestId("activity-list")).toContainText("a modifié les paramètres (alerts)");
  await page.getByRole("navigation", { name: "Filtrer par type" }).getByRole("link", { name: "Équipe" }).click();
  await expect(page).toHaveURL(/type=team/);
  await expectNoHorizontalScroll(page);

  const staff = await addMember(agency.agencyId, "staff");
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await login(p2, staff.email, staff.password);
  await p2.goto("/activity");
  await p2.waitForURL(/\/dashboard/);
  await ctx.close();
});

test("privacy: export a client's data, anonymize them; the public policy page", async ({ page }) => {
  const agency = await createTestAgency();
  const tag = uid().replace(/[^a-z]/g, "").slice(-5).toUpperCase().padEnd(5, "Q");
  const { data: client } = await admin()
    .from("clients")
    .insert({ agency_id: agency.agencyId, full_name: `Yassir ${tag}`, id_type: "cin", id_number: `PV${tag}`, phone: "+212622223333" })
    .select("id")
    .single();
  await addVehicle(agency.agencyId, { plate: `PV${uid().slice(-4).toUpperCase()}-A-6` });
  await login(page, agency.email, agency.password);
  await page.goto("/settings?section=data");
  const tools = page.getByTestId("privacy-tools");
  await tools.getByLabel("Nom, CIN ou téléphone du client").fill(`yassir ${tag.toLowerCase()}`);
  await tools.getByRole("button", { name: "Chercher" }).click();
  const hit = tools.getByTestId("privacy-hits").getByRole("listitem").first();
  await expect(hit).toContainText(`Yassir ${tag}`);

  const res = await page.request.get(`/api/clients/${client!.id}/export`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain(`PV${tag}`);

  await hit.getByRole("button", { name: "Anonymiser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Anonymiser" }).click();
  await expect(page.getByText("Client anonymisé.").first()).toBeVisible();
  const { data: after } = await admin().from("clients").select("full_name, phone, anonymized_at").eq("id", client!.id).single();
  expect(after).toMatchObject({ full_name: "Client anonymisé", phone: null });
  expect(after?.anonymized_at).toBeTruthy();
  await expectNoHorizontalScroll(page);

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Politique de confidentialité" })).toBeVisible();
  await expect(page.locator("main")).toContainText("09-08");
});
