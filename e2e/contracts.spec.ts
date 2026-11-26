import { expect, test } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

async function contractWithTwoDrivers(options: { complete: boolean }) {
  const agency = await createTestAgency({ name: `Agence Prestige Location Voitures Marrakech Ménara ${uid()}` });
  const staff = await addMember(agency.agencyId, "staff");
  const vehicleId = await addVehicle(agency.agencyId, { plate: `PDF${uid().slice(-4).toUpperCase()}-A-6`, brand_model: "Mercedes-Benz Classe C 220d AMG Line" });
  const sb = admin();
  await sb.from("agencies").update({ address: "Avenue Mohammed VI, Résidence Al Andalous, Immeuble 12, Bureau 4", city: "Marrakech", rc: "RC-12345", ice: "001234567000089", contract_terms: "1. وثيقة باللغة العربية.\n2. Le véhicule est rendu propre." }).eq("id", agency.agencyId);
  const { data: d1 } = await sb
    .from("clients")
    .insert({ agency_id: agency.agencyId, full_name: "Mohammed Amine Ben Abdelkader El Idrissi Alaoui Chérif", phone: "+212661000001", id_type: "cin", id_number: `ZZ${uid().slice(-6)}`, license_number: options.complete ? "LIC-1" : null, address: "حي الرياض، زنقة 7، الرباط", nationality: "Marocaine", birth_date: "1985-04-12", birth_place: "Fès" })
    .select("id")
    .single();
  const { data: d2 } = await sb
    .from("clients")
    .insert({ agency_id: agency.agencyId, full_name: "Jean-Christophe de la Fontaine-Beaumarchais", id_type: "passport", id_number: `FR${uid().slice(-7)}`, license_number: "FR-998877", nationality: "Française" })
    .select("id")
    .single();
  const { data: r } = await sb
    .from("reservations")
    .insert({
      agency_id: agency.agencyId,
      vehicle_id: vehicleId,
      client_id: d1!.id,
      second_driver_id: d2!.id,
      start_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      end_at: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      daily_price: 1200,
      delivery: true,
      delivery_place: "Aéroport Marrakech Ménara, Terminal 1, parking P2",
      return_place: "Hôtel La Mamounia",
      delivery_fee: 250,
      km_out: options.complete ? 41000 : null,
      fuel_out: options.complete ? 4 : null,
      equipment: ["Roue de secours", "Cric", "Siège bébé"],
      documents_given: ["Carte grise", "Attestation d'assurance"],
      notes: "Rayure légère pare-choc arrière droit, notée au départ avec le client.",
    })
    .select("id, contract_number")
    .single();
  return { agency, staff, reservationId: r!.id, contractNumber: r!.contract_number };
}

test("contract page: missing information blocks nothing but is listed with links, then ready to sign", async ({ page }) => {
  const c = await contractWithTwoDrivers({ complete: false });
  await login(page, c.staff.email, c.staff.password);
  await page.goto("/contracts");
  await expect(page.getByRole("link", { name: /^À signer/ })).toContainText("1");
  // Contrats = the document: rows offer Signer / PDF, never Démarrer or Retour (those are in Réservations)
  const list = page.getByTestId("contract-list");
  await expect(list.getByRole("link", { name: "Signer" }).first()).toBeVisible();
  await expect(list.getByRole("link", { name: /^(Démarrer|Retour)$/ })).toHaveCount(0);
  await page.getByTestId("contract-list").getByRole("link", { name: new RegExp(c.contractNumber) }).click();
  await page.waitForURL(/\/contracts\/[0-9a-f-]{36}/);

  const missing = page.getByTestId("missing-info");
  await expect(missing).toContainText("Permis du conducteur 1");
  await expect(missing).toContainText("Kilométrage au départ");
  await expect(page.getByTestId("paper-contract")).toContainText("Jean-Christophe de la Fontaine-Beaumarchais");
  await expectNoHorizontalScroll(page);

  await missing.getByRole("link", { name: "Permis du conducteur 1" }).click();
  await page.waitForURL(/\/reservations\/[0-9a-f-]{36}\/edit\?step=1/);
  await expect(page.getByText("Étape 2 sur 4")).toBeVisible();
});

test("PDF: long names, two drivers, delivery and Arabic labels render on 2 A4 pages", async ({ page }) => {
  const c = await contractWithTwoDrivers({ complete: true });
  await login(page, c.agency.email, c.agency.password);
  await page.goto(`/contracts/${c.reservationId}`);
  await expect(page.getByTestId("ready-to-sign")).toBeVisible();
  await expect(page.getByTestId("contract-whatsapp")).toHaveAttribute("href", /wa\.me\/212661000001\?text=/);

  for (const lang of ["fr", "ar"]) {
    const res = await page.request.get(`/api/contracts/${c.reservationId}/pdf?lang=${lang}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    const body = await res.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.toString("latin1")).toMatch(/\/Count 2\b/); // contract + terms
    expect(body.length).toBeGreaterThan(20_000); // fonts embedded
  }
});

test("a user of another agency cannot get this PDF", async ({ page }) => {
  const c = await contractWithTwoDrivers({ complete: true });
  const other = await createTestAgency();
  await login(page, other.email, other.password);
  const res = await page.request.get(`/api/contracts/${c.reservationId}/pdf`);
  expect(res.status()).toBe(404);
});
