import { expect, test, type Page } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

const PHOTO = "e2e/fixtures/car-photo.jpg";
const VIDEO = "e2e/fixtures/car-video.webm";

/** "Prendre les photos": one tap per side (the camera opens; here a file stands in for it). */
async function photographFaces(page: Page) {
  await page.getByTestId("source-camera").click();
  for (const view of ["front", "back", "left", "right"]) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId(`photo-${view}`).click();
    await (await chooser).setFiles(PHOTO);
    await expect(page.getByTestId(`photo-${view}`).locator("img")).toBeVisible({ timeout: 20_000 });
  }
}

/** "Importer des photos": several files at once fill the empty boxes in order. */
async function importFaces(page: Page) {
  await page.getByTestId("source-files").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("import-many").click();
  await (await chooser).setFiles([PHOTO, PHOTO, PHOTO, PHOTO]);
  await expect(page.getByText("4 photos importées.").first()).toBeVisible({ timeout: 40_000 });
  for (const view of ["front", "back", "left", "right"]) await expect(page.getByTestId(`photo-${view}`).locator("img")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("photo-wheels").locator("img")).toHaveCount(0);
}

/** An agency with one car out on rental, inspection turned on (photos or video). */
async function rentalWithInspection(mode: "photos" | "video") {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const car = await addVehicle(agency.agencyId, { plate: `I${uid().slice(-5).toUpperCase()}-A-6`, brand_model: "Hyundai Tucson" });
  const sb = admin();
  await sb.from("agencies").update({ inspection_enabled: true, inspection_mode: mode }).eq("id", agency.agencyId);
  const { data: client } = await sb.from("clients").insert({ agency_id: agency.agencyId, full_name: "Client Inspection", id_type: "cin", id_number: `IN${Math.floor(100000 + Math.random() * 899999)}` }).select("id").single();
  const { data: r } = await sb
    .from("reservations")
    .insert({ agency_id: agency.agencyId, vehicle_id: car, client_id: client!.id, daily_price: 400, status: "on_rental", signed_at: new Date(Date.now() - 86_400_000).toISOString(), start_at: new Date(Date.now() - 86_400_000).toISOString(), end_at: new Date(Date.now() + 86_400_000).toISOString() })
    .select("id")
    .single();
  return { agency, staff, id: r!.id };
}

async function markDamage(page: Page, x: number, y: number, type: string) {
  const diagram = page.getByTestId("inspection-diagram");
  await diagram.scrollIntoViewIfNeeded();
  const box = (await diagram.boundingBox())!;
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await page.getByRole("dialog").getByRole("radio", { name: type }).click();
  await page.getByTestId("damage-save").click();
  await expect(page.getByText("Dégât noté.").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("inspection départ / retour: photos, marks, AI suggestion confirmed, new damage counted", async ({ page }) => {
  test.setTimeout(150_000);
  const { agency, staff, id } = await rentalWithInspection("photos");
  const sb = admin();
  const r = { id };

  // Its own section in the menu: the car out on rental waits for its return inspection
  await login(page, staff.email, staff.password);
  await page.goto("/inspections");
  await expect(page.getByTestId("inspections-returns").getByTestId("inspection-row").filter({ visible: true })).toContainText("Hyundai Tucson");
  await page.goto(`/inspections/${r.id}`);
  const card = page.getByTestId("inspection-card");
  await expect(card.getByTestId("inspection-departure")).toContainText("À faire");

  // Departure: 4 faces + a scratch at the front
  await card.getByTestId("inspection-departure").getByRole("link", { name: "Faire l'inspection" }).click();
  await page.waitForURL(/\/inspections\/[0-9a-f-]{36}\/departure$/);
  await expect(page.getByTestId("inspection-finish")).toBeDisabled();
  await photographFaces(page);
  await expectNoHorizontalScroll(page);
  await markDamage(page, 0.3, 0.12, "Rayure");
  await page.getByTestId("inspection-finish").click();
  await page.waitForURL(new RegExp(`/inspections/${r.id}$`));
  await expect(card.getByTestId("inspection-departure")).toContainText("Documenté · 4 photos");

  // Return: same scratch (already there) + a new dent on the right side
  await card.getByTestId("inspection-return").getByRole("link", { name: "Faire l'inspection" }).click();
  await page.waitForURL(/\/inspections\/[0-9a-f-]{36}\/return$/);
  await importFaces(page);
  await markDamage(page, 0.3, 0.12, "Rayure");
  await markDamage(page, 0.85, 0.55, "Bosse / choc");
  await page.getByTestId("inspection-finish").click();
  await page.waitForURL(new RegExp(`/inspections/${r.id}$`));
  await expect(page.getByTestId("inspection-result")).toContainText("1 nouveau dégât au retour");

  // AI comparison (test AI): one suggestion on the right side, confirmed by staff
  await page.getByTestId("ai-compare").click();
  const sugg = page.getByTestId("ai-suggestions");
  await expect(sugg).toContainText("1 suggestion de l'IA à vérifier", { timeout: 30_000 });
  await sugg.getByRole("button", { name: /Confirmer le repère/ }).click();
  await expect(page.getByText("Dégât confirmé.")).toBeVisible();
  await expect(page.getByTestId("inspection-result")).toContainText("2 nouveaux dégâts au retour");
  await expectNoHorizontalScroll(page);

  // État des lieux PDF: report page + photos page; another agency cannot get it
  await expect(page.getByTestId("inspection-report")).toBeVisible();
  await expect(page.getByTestId("report-pdf")).toHaveAttribute("href", `/api/inspections/${r.id}/pdf`);
  for (const lang of ["fr", "ar"]) {
    const res = await page.request.get(`/api/inspections/${r.id}/pdf?lang=${lang}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    const body = await res.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.toString("latin1")).toMatch(/\/Count 2\b/);
  }
  const other = await createTestAgency();
  const otherCtx = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
  const otherPage = await otherCtx.newPage();
  await login(otherPage, other.email, other.password);
  expect((await otherPage.request.get(`/api/inspections/${r.id}/pdf`)).status()).toBe(404);
  await otherCtx.close();

  // Photos are private: the database only holds paths inside this agency's folder
  const { data: photos } = await sb.from("inspection_photos").select("storage_path").eq("agency_id", agency.agencyId);
  expect(photos).toHaveLength(8);
  for (const p of photos!) expect(p.storage_path.startsWith(`${agency.agencyId}/inspections/`)).toBe(true);
});

test("inspection is off by default: no menu item; an admin turns it on with the video mode", async ({ page }, testInfo) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  await login(page, staff.email, staff.password);
  await page.goto("/inspections");
  await expect(page.getByText("L'inspection n'est pas activée")).toBeVisible();
  await expect(page.getByText("Demandez à un administrateur")).toBeVisible();
  const menu = async () => {
    if (testInfo.project.name === "phone") await page.getByRole("button", { name: "Plus" }).click();
    return page.locator('a[href$="/inspections"]').filter({ visible: true });
  };
  await expect(await menu()).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, agency.email, agency.password);
  await page.goto("/settings?section=inspection");
  await page.getByRole("radiogroup", { name: "Utiliser l'inspection des voitures ?" }).getByRole("radio", { name: "Oui" }).click();
  await page.getByRole("radio", { name: /^Vidéo/ }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées").first()).toBeVisible();
  const { data } = await admin().from("agencies").select("inspection_enabled, inspection_mode").eq("id", agency.agencyId).single();
  expect(data).toEqual({ inspection_enabled: true, inspection_mode: "video" });
  await page.goto("/inspections");
  await expect(page.getByText("Mode vidéo")).toBeVisible();
  await expect((await menu()).first()).toBeVisible();
});

test("video mode: one video at departure and at return, shown side by side, no AI", async ({ page }) => {
  test.setTimeout(120_000);
  const { agency, staff, id } = await rentalWithInspection("video");
  await login(page, staff.email, staff.password);
  for (const kind of ["departure", "return"] as const) {
    await page.goto(`/inspections/${id}/${kind}`);
    await expect(page.getByTestId("inspection-photos")).toHaveCount(0);
    await expect(page.getByTestId("inspection-finish")).toBeDisabled();
    // Departure filmed with "Filmer maintenant" would need a real camera: both use "Importer une vidéo" here
    await page.getByTestId("source-files").click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("video-pick").click();
    await (await chooser).setFiles(VIDEO);
    await expect(page.getByTestId("inspection-video-player")).toBeVisible({ timeout: 20_000 });
    // It really plays (the security rules allow private video links)
    await expect.poll(() => page.getByTestId("inspection-video-player").evaluate((v: HTMLVideoElement) => (v.error ? -1 : v.readyState)), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await expectNoHorizontalScroll(page);
    await page.getByTestId("inspection-finish").click();
    await page.waitForURL(new RegExp(`/inspections/${id}$`));
  }
  const card = page.getByTestId("inspection-card");
  await expect(card.getByTestId("inspection-departure")).toContainText("Documenté · vidéo");
  await expect(card.getByTestId("inspection-return")).toContainText("Documenté · vidéo");
  await expect(page.getByTestId("inspection-videos").locator("video")).toHaveCount(2);
  await expect(page.getByTestId("ai-compare")).toHaveCount(0);
  const { data } = await admin().from("inspections").select("mode, video_path").eq("reservation_id", id);
  expect(data).toHaveLength(2);
  for (const i of data!) {
    expect(i.mode).toBe("video");
    expect(i.video_path!.startsWith(`${agency.agencyId}/inspections/`)).toBe(true);
  }
});

test("Démarrer reminds the departure inspection: do it, then come straight back to start", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const car = await addVehicle(agency.agencyId, { plate: `R${uid().slice(-5).toUpperCase()}-A-6`, brand_model: "Kia Picanto" });
  const sb = admin();
  await sb.from("agencies").update({ inspection_enabled: true }).eq("id", agency.agencyId);
  const { data: client } = await sb.from("clients").insert({ agency_id: agency.agencyId, full_name: "Client Rappel", id_type: "cin", id_number: `RP${Math.floor(100000 + Math.random() * 899999)}` }).select("id").single();
  const { data: r } = await sb
    .from("reservations")
    .insert({ agency_id: agency.agencyId, vehicle_id: car, client_id: client!.id, daily_price: 250, km_out: 10000, fuel_out: 4, signed_at: new Date().toISOString(), start_at: new Date(Date.now() + 3_600_000).toISOString(), end_at: new Date(Date.now() + 3 * 86_400_000).toISOString() })
    .select("id")
    .single();

  await login(page, staff.email, staff.password);
  // A departure today, not inspected: badge on the Inspection menu item
  if (testInfo.project.name !== "phone") await expect(page.getByRole("complementary").getByRole("link", { name: /Inspection/ })).toHaveText("Inspection1");

  await page.goto(`/reservations/${r!.id}`);
  await page.getByTestId("start-rental").click();
  const reminder = page.getByTestId("inspection-reminder-departure");
  await expect(reminder).toBeVisible();
  await reminder.getByRole("link", { name: "Faire l'inspection de départ" }).click();
  await page.waitForURL(/\/departure\?then=start$/);
  await importFaces(page);
  await page.getByTestId("inspection-finish").click();

  // Back on the reservation, Démarrer already open, no reminder any more
  await page.waitForURL(new RegExp(`/reservations/${r!.id}\\?do=start$`));
  const dialog = page.getByTestId("start-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("inspection-reminder-departure")).toHaveCount(0);
  await dialog.getByTestId("start-confirm").click();
  await expect(page.getByText("Location démarrée.")).toBeVisible();
});

test("Retour with a new damage: the fee is kept from the caution, the rest is still owed", async ({ page }) => {
  test.setTimeout(90_000);
  const { agency, staff, id } = await rentalWithInspection("photos");
  const sb = admin();
  await sb.from("reservations").update({ franchise: 5000, deposit_taken: true, deposit_amount: 2000, km_out: 30000, fuel_out: 4 }).eq("id", id);
  // Both inspections done; the return found a new dent on the right side
  const { data: ins } = await sb
    .from("inspections")
    .insert([
      { agency_id: agency.agencyId, reservation_id: id, kind: "departure", completed_at: new Date(Date.now() - 86_400_000).toISOString() },
      { agency_id: agency.agencyId, reservation_id: id, kind: "return", completed_at: new Date().toISOString() },
    ])
    .select("id, kind");
  const ret = ins!.find((i) => i.kind === "return")!.id;
  await sb.from("inspection_damages").insert({ agency_id: agency.agencyId, inspection_id: ret, x: 0.85, y: 0.55, type: "dent", view: "right" });

  await login(page, staff.email, staff.password);
  await page.goto(`/reservations/${id}?do=return`);
  const dialog = page.getByTestId("return-dialog");
  await expect(dialog.getByTestId("damage-found")).toContainText("1 nouveau dégât : Bosse / choc (Côté droit)");
  await dialog.getByLabel("Kilométrage au retour").fill("30500");
  await dialog.getByRole("radio", { name: "4/4" }).click();
  // More than the franchise is refused
  await dialog.getByLabel("Frais de dégâts").fill("6000");
  await dialog.getByRole("button", { name: "Enregistrer le retour" }).click();
  await expect(dialog.getByText("ne peuvent pas dépasser la franchise")).toBeVisible();
  await dialog.getByLabel("Frais de dégâts").fill("3500");
  const settle = dialog.getByTestId("damage-settlement");
  await expect(settle).toContainText("Retenu sur la caution : 2 000 MAD");
  await expect(settle).toContainText("Caution à rendre : 0 MAD");
  await expect(settle).toContainText("le client doit encore 1 500 MAD");
  await expectNoHorizontalScroll(page);
  await dialog.getByLabel("Montant encaissé maintenant").fill("0");
  await dialog.getByRole("button", { name: "Enregistrer le retour" }).click();
  await expect(page.getByText("Retour enregistré : la voiture est de nouveau disponible.")).toBeVisible();

  const { data: r } = await sb.from("reservations").select("damage_fee, damage_note").eq("id", id).single();
  expect(Number(r!.damage_fee)).toBe(3500);
  expect(r!.damage_note).toContain("Bosse / choc");
  const { data: pays } = await sb.from("reservation_payments").select("amount, kind, note").eq("reservation_id", id);
  expect(pays!.find((p) => p.kind === "extra")).toMatchObject({ amount: 2000, note: "Retenu sur la caution (dégâts)" });
  expect(pays!.some((p) => p.kind === "deposit_refund")).toBe(false);
  await expect(page.getByText("Frais de dégâts").first()).toBeVisible();

  // Statistiques (admin): the fee is income on its own, added to the profit
  await page.context().clearCookies();
  await login(page, agency.email, agency.password);
  await page.goto("/statistics?period=days");
  await expect(page.getByTestId("stats-damages")).toContainText("3 500 MAD");
});

test("a new departure starts with the car's known damages; the car page shows them", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const car = await addVehicle(agency.agencyId, { plate: `K${uid().slice(-5).toUpperCase()}-A-6`, brand_model: "Seat Ibiza" });
  const sb = admin();
  await sb.from("agencies").update({ inspection_enabled: true }).eq("id", agency.agencyId);
  const { data: client } = await sb.from("clients").insert({ agency_id: agency.agencyId, full_name: "Client Connu", id_type: "cin", id_number: `KC${Math.floor(100000 + Math.random() * 899999)}` }).select("id").single();
  const day = 86_400_000;
  // Last rental of this car: returned, its return inspection found a dent
  const { data: old } = await sb
    .from("reservations")
    .insert({ agency_id: agency.agencyId, vehicle_id: car, client_id: client!.id, daily_price: 300, status: "returned", signed_at: new Date(Date.now() - 6 * day).toISOString(), start_at: new Date(Date.now() - 6 * day).toISOString(), end_at: new Date(Date.now() - 3 * day).toISOString(), actual_return_at: new Date(Date.now() - 3 * day).toISOString() })
    .select("id, contract_number")
    .single();
  const { data: ret } = await sb.from("inspections").insert({ agency_id: agency.agencyId, reservation_id: old!.id, kind: "return", completed_at: new Date(Date.now() - 3 * day).toISOString() }).select("id").single();
  await sb.from("inspection_damages").insert({ agency_id: agency.agencyId, inspection_id: ret!.id, x: 0.85, y: 0.55, type: "dent", view: "right", note: "Bosse portière" });
  // Next rental of the same car
  const { data: next } = await sb
    .from("reservations")
    .insert({ agency_id: agency.agencyId, vehicle_id: car, client_id: client!.id, daily_price: 300, signed_at: new Date().toISOString(), start_at: new Date(Date.now() + day).toISOString(), end_at: new Date(Date.now() + 3 * day).toISOString() })
    .select("id")
    .single();

  await login(page, staff.email, staff.password);
  await page.goto(`/inspections/${next!.id}/departure`);
  await expect(page.getByTestId("carried-hint")).toBeVisible();
  const list = page.getByTestId("inspection-damages");
  await expect(list.locator("li")).toHaveCount(1);
  await expect(list).toContainText("Bosse / choc");
  await expect(list).toContainText(`Déjà là · contrat ${old!.contract_number}`);
  await expect(list).toContainText("Bosse portière");

  await page.goto(`/fleet/${car}`);
  const known = page.getByTestId("known-damages");
  await expect(known).toContainText("Bosse / choc");
  await expect(known).toContainText(old!.contract_number);
  await expectNoHorizontalScroll(page);
});
