import { expect, test } from "@playwright/test";
import { createTestAgency, latestEmailHtml, login, openUserMenu, uid } from "./helpers";

test("an admin invites by email; the person creates an account and joins as staff", async ({ page, browser }) => {
  const agency = await createTestAgency();
  const invitee = `invitee-${uid()}@test.parcolia.ma`;

  await login(page, agency.email, agency.password);
  await page.goto("/team");
  await page.getByRole("button", { name: "Inviter" }).click();
  await page.getByLabel("Adresse e-mail").fill(invitee);
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText(`Invitation envoyée à ${invitee}.`)).toBeVisible();
  await expect(page.getByTestId("invitation-list")).toContainText(invitee);

  // The branded email arrives in the local mailbox
  const html = await latestEmailHtml(invitee);
  expect(html).toContain(agency.name);
  expect(html).toContain("Propulsé par Parcolia");
  const link = /href="([^"]*\/invite\/[^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
  expect(link).toBeTruthy();

  // The invited person, in a fresh browser
  const other = await browser.newContext();
  const invitedPage = await other.newPage();
  await invitedPage.goto(link!);
  await expect(invitedPage.getByRole("heading", { name: `Rejoindre ${agency.name}` })).toBeVisible();
  await expect(invitedPage.getByLabel("Adresse e-mail")).toHaveValue(invitee);
  await invitedPage.getByLabel("Nom et prénom").fill("Nouvel Agent");
  await invitedPage.getByLabel("Téléphone").fill("0661000000");
  await invitedPage.getByLabel("Mot de passe", { exact: true }).fill("Agent-2026-ok");
  await invitedPage.getByRole("button", { name: "Créer mon accès et rejoindre" }).click();
  await invitedPage.waitForURL(/\/dashboard/);
  await expect(invitedPage.getByTestId("header-agency-name")).toHaveText(agency.name);
  await openUserMenu(invitedPage);
  await expect(invitedPage.getByTestId("menu-team")).toHaveCount(0);
  await other.close();

  // Back on the admin side: the new member is listed, the invitation is gone
  await page.reload();
  await expect(page.getByTestId("member-list")).toContainText("Nouvel Agent");
  await expect(page.getByTestId("invitation-list")).toHaveCount(0);
});
