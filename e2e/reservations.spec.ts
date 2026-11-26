import { expect, test, type Page } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

async function setupAgency() {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const plate = `R${uid().slice(-5).toUpperCase()}-A-6`;
  const vehicleId = await addVehicle(agency.agencyId, { plate, brand_model: "Dacia Sandero", daily_rate: 300 });
  // A known client with one past rental
  const sb = admin();
  const cin = `AB${Math.floor(100000 + Math.random() * 899999)}`;
  const { data: client } = await sb
    .from("clients")
    .insert({ agency_id: agency.agencyId, full_name: "Karim Connu", phone: "+212600000099", id_type: "cin", id_number: cin, license_number: "P-12345", address: "Rue Test, Rabat" })
    .select("id")
    .single();
  await sb.from("reservations").insert({
    agency_id: agency.agencyId,
    vehicle_id: vehicleId,
    client_id: client!.id,
    start_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    end_at: new Date(Date.now() - 18 * 86_400_000).toISOString(),
    daily_price: 300,
    status: "returned",
    signed_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  });
  return { agency, staff, plate, vehicleId, cin, clientId: client!.id };
}

async function goNext(page: Page) {
  await page.getByRole("button", { name: "Continuer" }).click();
}

test("new reservation: an existing CIN fills the client, the car list only shows free cars", async ({ page }) => {
  const s = await setupAgency();
  await login(page, s.staff.email, s.staff.password);
  await page.goto("/reservations/new");

  // Step 1 — dates (defaults: next hour → tomorrow) and car
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();
  await page.getByTestId("available-cars").getByRole("radio", { name: /Dacia Sandero/ }).click();
  await expectNoHorizontalScroll(page);
  await goNext(page);

  // Step 2 — the ID number is the first field and autofills everything
  await expect(page.getByText("Étape 2 sur 4")).toBeVisible();
  await page.getByLabel("Numéro de CIN").fill(`${s.cin.slice(0, 2).toLowerCase()}-${s.cin.slice(2, 5)} ${s.cin.slice(5)}`);
  await expect(page.getByText("Client trouvé : Karim Connu")).toBeVisible();
  await expect(page.getByLabel("Nom et prénom").first()).toHaveValue("Karim Connu");
  await expect(page.getByTestId("driver1-known")).toContainText("Client déjà connu · 1 location · dernière le");
  await page.getByLabel("Téléphone").first().fill("0661223344");
  await goNext(page);

  // Step 3 — price prefilled from the car, advance
  await expect(page.getByText("Étape 3 sur 4")).toBeVisible();
  await page.getByLabel("Avance payée").fill("100");
  await goNext(page);

  // Step 4 — check-out, then save
  await expect(page.getByText("Étape 4 sur 4")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();
  // The new reservation opens on its own page (the work), with a link to the contract
  await page.waitForURL(/\/reservations\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("reservation-title")).toHaveText("Karim Connu");
  await expect(page.getByTestId("reservation-balance")).toContainText("200 MAD");
  await page.getByTestId("open-contract").click();
  await page.waitForURL(/\/contracts\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("contract-title")).toHaveText(/^Contrat C-\d+$/);
  await expect(page.getByTestId("contract-balance")).toContainText("200 MAD");

  // Editing the autofilled phone updated the same client (no duplicate)
  const { data: clients } = await admin().from("clients").select("id, phone").eq("agency_id", s.agency.agencyId);
  expect(clients).toHaveLength(1);
  expect(clients![0].phone).toBe("+212661223344");

  // Same dates again: the car is not offered any more (no double booking)
  await page.goto("/reservations/new");
  await expect(page.getByTestId("unavailable-note")).toContainText("1 voiture indisponible : 1 déjà réservée(s)");
  await expect(page.getByTestId("available-cars").getByRole("radio", { name: /Dacia Sandero/ })).toHaveCount(0);
});

test("the contract number must be unique in the agency", async ({ page }) => {
  const s = await setupAgency();
  await admin().from("reservations").insert({
    agency_id: s.agency.agencyId,
    vehicle_id: s.vehicleId,
    client_id: s.clientId,
    contract_number: "P-0457",
    start_at: new Date(Date.now() + 40 * 86_400_000).toISOString(),
    end_at: new Date(Date.now() + 42 * 86_400_000).toISOString(),
    daily_price: 300,
  });
  await login(page, s.agency.email, s.agency.password);
  await page.goto("/reservations/new");
  await page.getByLabel("N° de contrat").fill("P-0457");
  await page.getByTestId("available-cars").getByRole("radio", { name: /Dacia Sandero/ }).click();
  await goNext(page);
  await expect(page.getByText("Ce numéro de contrat existe déjà dans votre agence.")).toBeVisible();
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();
});

test("sign, start, return: the car km is updated and the infraction finder knows who had it", async ({ page }) => {
  const s = await setupAgency();
  const start = new Date(Date.now() - 2 * 86_400_000);
  const { data: r } = await admin()
    .from("reservations")
    .insert({
      agency_id: s.agency.agencyId,
      vehicle_id: s.vehicleId,
      client_id: s.clientId,
      start_at: start.toISOString(),
      end_at: new Date(Date.now() + 86_400_000).toISOString(),
      daily_price: 300,
      km_out: 40000,
      fuel_out: 4,
      deposit_taken: true,
      deposit_amount: 2000,
    })
    .select("id, contract_number")
    .single();

  await login(page, s.staff.email, s.staff.password);
  // The contract is the document only: sign, PDF, WhatsApp — never Démarrer / Retour
  await page.goto(`/contracts/${r!.id}`);
  await expect(page.getByTestId("sign-contract")).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer la location" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retour" })).toHaveCount(0);

  // The reservation does the work: Démarrer asks if the contract is signed
  await page.goto(`/reservations/${r!.id}`);
  await page.getByTestId("start-rental").click();
  const startDialog = page.getByTestId("start-dialog");
  await expect(startDialog.getByTestId("start-confirm")).toBeDisabled();
  await startDialog.getByRole("radio", { name: "Non" }).click();
  await expect(startDialog.getByRole("link", { name: /Ouvrir le contrat/ })).toBeVisible();
  await startDialog.getByRole("radio", { name: "Oui" }).click();
  await startDialog.getByTestId("start-confirm").click();
  await expect(page.getByText("Location démarrée.")).toBeVisible();
  const { data: started } = await admin().from("reservations").select("status, signed_at").eq("id", r!.id).single();
  expect(started!.status).toBe("on_rental");
  expect(started!.signed_at).not.toBeNull();

  // From the list, "Retour" opens the return dialog directly
  await page.goto("/reservations");
  await page.getByTestId("returns").getByRole("link", { name: "Retour" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Kilométrage au retour").fill("40750");
  await dialog.getByRole("radio", { name: "3/4" }).click();
  await dialog.getByRole("button", { name: "Enregistrer le retour" }).click();
  await expect(page.getByText("Retour enregistré : la voiture est de nouveau disponible.")).toBeVisible();

  const { data: car } = await admin().from("vehicles").select("current_km").eq("id", s.vehicleId).single();
  expect(car!.current_km).toBe(40750);

  // Infraction finder: who had this car yesterday?
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/reservations?plate=${encodeURIComponent(s.plate.toLowerCase())}&date=${yesterday}`);
  const results = page.getByTestId("infraction-results");
  await expect(results).toContainText("Karim Connu");
  await expect(results).toContainText(r!.contract_number);
  await expect(results.getByRole("link", { name: "WhatsApp" })).toBeVisible();
});

test("search finds a reservation by phone, CIN or plate", async ({ page }) => {
  const s = await setupAgency();
  await login(page, s.agency.email, s.agency.password);
  for (const q of ["0600 000 099", s.cin.toLowerCase(), s.plate.replaceAll("-", " ")]) {
    await page.goto(`/reservations?q=${encodeURIComponent(q)}`);
    await expect(page.getByTestId("reservation-row").first()).toContainText("Karim Connu");
  }
});

test("car later: book without a car, choose it on the reservation, then start", async ({ page }) => {
  const s = await setupAgency();
  await login(page, s.staff.email, s.staff.password);
  await page.goto("/reservations/new");

  // Step 1 — "Plus tard": no car list, a note explains when the car is chosen
  await page.getByRole("radiogroup", { name: "Quand choisir la voiture ?" }).getByRole("radio", { name: /Plus tard/ }).click();
  await expect(page.getByTestId("car-later-note")).toBeVisible();
  await expect(page.getByTestId("available-cars")).toHaveCount(0);
  await goNext(page);

  await page.getByLabel("Numéro de CIN").fill(s.cin);
  await expect(page.getByText("Client trouvé : Karim Connu")).toBeVisible();
  await goNext(page);

  // Step 3 — no car, so the price is typed by hand
  await page.getByLabel("Prix par jour").fill("250");
  await goNext(page);
  await expect(page.getByText("Le kilométrage et le carburant seront notés")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();
  await page.waitForURL(/\/reservations\/[0-9a-f-]{36}$/);

  // The reservation asks for the car; the start waits for it
  const actions = page.getByTestId("reservation-actions");
  await expect(actions.getByRole("button", { name: "Démarrer la location" })).toBeDisabled();
  await actions.getByRole("button", { name: "Choisir la voiture" }).click();
  const dialog = page.getByTestId("assign-car-dialog");
  await dialog.getByRole("radio", { name: /Dacia Sandero/ }).click();
  // Car price (300) differs from the agreed price (250): keep the agreed one
  await dialog.getByRole("radio", { name: /Garder/ }).click();
  await dialog.getByRole("button", { name: "Valider la voiture" }).click();
  await expect(page.getByText("Voiture enregistrée")).toBeVisible();
  await expect(actions.getByRole("button", { name: "Démarrer la location" })).toBeEnabled();
  await expect(actions.getByRole("button", { name: "Changer de voiture" })).toBeVisible();

  const id = page.url().split("/").pop()!;
  const { data } = await admin().from("reservations").select("vehicle_id, daily_price").eq("id", id).single();
  expect(data).toEqual({ vehicle_id: s.vehicleId, daily_price: 250 });
  await expectNoHorizontalScroll(page);
});
