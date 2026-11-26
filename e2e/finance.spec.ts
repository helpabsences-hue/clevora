import { expect, test } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(1); // the 1st: today is always on or after it
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

test("Achat et crédit: the admin records a credit; the car page and Statistiques say what is left and if the car pays back", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const id = await addVehicle(agency.agencyId, { plate: `F${uid().slice(-5).toUpperCase()}-A-6`, brand_model: "Dacia Jogger", daily_rate: 400 });
  // One returned rental of 3 days (1 200 MAD) and a 200 MAD charge
  const sb = admin();
  const { data: client } = await sb.from("clients").insert({ agency_id: agency.agencyId, full_name: "Client Fin", id_type: "cin", id_number: `FN${Math.floor(100000 + Math.random() * 899999)}` }).select("id").single();
  const day = 86_400_000;
  const now = Date.now();
  await sb.from("reservations").insert({
    agency_id: agency.agencyId, vehicle_id: id, client_id: client!.id, daily_price: 400, status: "returned",
    start_at: new Date(now - 10 * day).toISOString(), end_at: new Date(now - 7 * day).toISOString(),
    actual_return_at: new Date(now - 7 * day).toISOString(), signed_at: new Date(now - 10 * day).toISOString(),
  });
  await sb.from("charges").insert({ agency_id: agency.agencyId, vehicle_id: id, category: "lavage", amount: 200, date: new Date(now - 5 * day).toISOString().slice(0, 10) });

  await login(page, agency.email, agency.password);
  await page.goto(`/fleet/${id}`);
  const card = page.getByTestId("finance-card");
  await expect(card).toContainText("Ajoutez le prix d'achat");
  await card.getByRole("button", { name: "Ajouter l'achat" }).click();
  const dialog = page.getByTestId("finance-dialog");
  await dialog.getByLabel("Date d'achat").fill(monthsAgo(13));
  await dialog.getByLabel("Prix d'achat").fill("150000");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  // A credit needs its details
  await expect(dialog.getByText("Ce champ est obligatoire.").first()).toBeVisible();
  await dialog.getByLabel("Apport (avance)").fill("30000");
  await dialog.getByLabel("Crédit par mois", { exact: true }).fill("3000");
  await dialog.getByLabel("Nombre de mois").fill("48");
  await dialog.getByLabel("Date de la 1re mensualité").fill(monthsAgo(12));
  await dialog.getByLabel("Organisme (facultatif)").fill("Wafasalaf");
  await expect(dialog.getByTestId("finance-total")).toContainText("174 000 MAD");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Achat et crédit enregistrés.")).toBeVisible();

  await expect(card).toContainText("13 / 48");
  await expect(card.getByTestId("finance-credit-state")).toContainText("Encore 35 mois");
  await expect(card).toContainText("105 000 MAD"); // credit left
  await expect(card).toContainText("1 200 MAD"); // rental revenue
  await expect(card).toContainText("69 000 MAD"); // credit paid: 30 000 + 13 × 3 000
  await expect(card).toContainText("-68 000 MAD"); // 1 200 − 200 − 69 000
  await expect(card.getByTestId("finance-payback")).toContainText("Rentabilisée à 1 %");
  await expect(card).not.toContainText("Gain moyen");
  await expectNoHorizontalScroll(page);

  await page.goto("/statistics");
  const row = page.getByTestId("profit-row").filter({ hasText: "Dacia Jogger", visible: true });
  await expect(row).toContainText("35 mois restants");
  await expect(row).toContainText("-68 000 MAD"); // since purchase
  await expect(row).toContainText("3 000 MAD"); // this month's credit payment
  await expectNoHorizontalScroll(page);

  // Staff never see it
  await page.context().clearCookies();
  await login(page, staff.email, staff.password);
  await page.goto(`/fleet/${id}`);
  await expect(page.getByRole("heading", { name: "Dacia Jogger" }).first()).toBeVisible();
  await expect(page.getByTestId("finance-card")).toHaveCount(0);
});
