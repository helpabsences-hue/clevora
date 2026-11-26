import { expect, test } from "@playwright/test";
import { addMember, admin, createPlatformAdmin, createTestAgency, expectNoHorizontalScroll, login } from "./helpers";

test("owner console: dashboard numbers, agencies with filters, quick actions, users and Parcolia admins, plans", async ({ page }) => {
  const owner = await createPlatformAdmin();
  const agency = await createTestAgency({ name: `Console ${Date.now()}` });
  const staff = await addMember(agency.agencyId, "staff");

  // The owner logs in with email + password like everyone, and lands on the console
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(owner.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/platform/);
  await expect(page.getByTestId("platform-kpis")).toContainText("Revenu mensuel");
  await expect(page.getByTestId("chart-signups")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Agencies: filter "En essai", open the new agency, extend its trial
  await page.getByRole("navigation", { name: "Menu Parcolia" }).getByRole("link", { name: "Agences" }).click();
  await page.getByRole("link", { name: /En essai/ }).click();
  await page.waitForURL(/status=trial/);
  await page.getByTestId("platform-list").getByRole("link", { name: new RegExp(agency.name) }).filter({ visible: true }).click();
  await expect(page.getByTestId("agency-activity")).toContainText("Clients");
  await expect(page.getByTestId("agency-activity")).toContainText("pas les données personnelles");
  const before = (await admin().from("agencies").select("trial_ends_at").eq("id", agency.agencyId).single()).data!.trial_ends_at!;
  await page.getByRole("button", { name: "Prolonger l'essai de 14 jours" }).click();
  await page.getByTestId("quick-confirm").click();
  await expect(page.getByText("Essai prolongé de 14 jours.")).toBeVisible();
  const after = (await admin().from("agencies").select("trial_ends_at").eq("id", agency.agencyId).single()).data!.trial_ends_at!;
  expect(new Date(after).getTime() - new Date(before).getTime()).toBeGreaterThan(13 * 86_400_000);

  // Suspend, then reactivate
  await page.getByRole("button", { name: "Suspendre" }).click();
  await page.getByTestId("quick-confirm").click();
  await expect(page.getByText("Agence suspendue.")).toBeVisible();
  expect((await admin().from("agencies").select("subscription_status").eq("id", agency.agencyId).single()).data!.subscription_status).toBe("suspended");
  await page.getByRole("button", { name: "Réactiver" }).click();
  await page.getByTestId("quick-confirm").click();
  await expect(page.getByText("Agence réactivée.")).toBeVisible();

  // Users: every account with its agency and role; make the staff member a Parcolia admin
  await page.goto("/platform/users");
  const search = page.getByRole("searchbox");
  await search.fill(staff.email);
  await search.press("Enter");
  await page.waitForURL(/q=/);
  await expect(page.getByTestId("platform-user").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId("platform-user").filter({ visible: true })).toContainText("Agent");
  await page.getByRole("button", { name: "Ajouter un admin Parcolia" }).click();
  await page.getByLabel("Adresse e-mail").fill("personne@nulle-part.ma");
  await page.getByTestId("add-admin-confirm").click();
  await expect(page.getByText("Aucun compte avec cet e-mail")).toBeVisible();
  await page.getByLabel("Adresse e-mail").fill(staff.email);
  await page.getByTestId("add-admin-confirm").click();
  await expect(page.getByText("Admin Parcolia ajouté.")).toBeVisible();
  await expect(page.getByTestId("platform-admins")).toContainText(staff.email);

  // Plans: the page lists the three plans with their prices
  await page.goto("/platform/plans");
  await expect(page.getByTestId("plan-pro")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.goto("/platform/payments");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paiements");

  // Clean up the extra Parcolia admin
  await admin().from("platform_admins").delete().eq("user_id", staff.userId);
});

test("an agency admin never sees the owner console and has no menu link to it", async ({ page }) => {
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.getByRole("button", { name: /Owner|menu/i }).first().click().catch(() => undefined);
  await expect(page.getByTestId("menu-platform")).toHaveCount(0);
  for (const path of ["/platform", "/platform/users", "/platform/plans"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
  }
});
