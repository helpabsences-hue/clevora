import { expect, test, type Page } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

const tick = (page: Page, name: RegExp) => page.getByRole("checkbox", { name }).filter({ visible: true }).check();

test("cars: tick several, delete; cars with history are kept and can be marked sold", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const free1 = await addVehicle(agency.agencyId, { plate: `X${uid().slice(-5).toUpperCase()}-A-6`, brand_model: "Kia Picanto" });
  const free2 = await addVehicle(agency.agencyId, { plate: `X${uid().slice(-5).toUpperCase()}-B-6`, brand_model: "Hyundai i10" });
  const used = await addVehicle(agency.agencyId, { plate: `X${uid().slice(-5).toUpperCase()}-D-6`, brand_model: "Dacia Logan" });
  await admin().from("charges").insert({ agency_id: agency.agencyId, vehicle_id: used, category: "lavage", amount: 50 });

  await login(page, agency.email, agency.password);
  await page.goto("/fleet");
  await tick(page, /Sélectionner Kia Picanto/);
  await tick(page, /Sélectionner Hyundai i10/);
  await tick(page, /Sélectionner Dacia Logan/);
  const bar = page.getByTestId("selection-bar");
  await expect(bar).toContainText("3 voitures sélectionnées");
  await expectNoHorizontalScroll(page);
  await bar.getByRole("button", { name: "Supprimer" }).click();
  await page.getByTestId("bulk-confirm").click();
  await expect(page.getByText("2 voitures supprimées.")).toBeVisible();
  const kept = page.getByTestId("bulk-kept");
  await expect(kept).toContainText("Dacia Logan");
  await kept.getByRole("button", { name: "Marquer vendue" }).click();
  await expect(page.getByText("1 voiture marquée vendue.")).toBeVisible();

  const { data } = await admin().from("vehicles").select("id, status").in("id", [free1, free2, used]);
  expect(data).toEqual([{ id: used, status: "sold" }]);

  // Staff never get the boxes
  await page.context().clearCookies();
  await login(page, staff.email, staff.password);
  await page.goto("/fleet");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("reservations: delete only those never started, cancel several at once; staff can cancel but not delete", async ({ page }) => {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const car = await addVehicle(agency.agencyId, { plate: `Y${uid().slice(-5).toUpperCase()}-A-6`, brand_model: "Renault Clio" });
  const sb = admin();
  const client = async (full_name: string) =>
    (await sb.from("clients").insert({ agency_id: agency.agencyId, full_name, id_type: "cin", id_number: `BK${Math.floor(100000 + Math.random() * 899999)}` }).select("id").single()).data!.id;
  const day = 86_400_000;
  const book = async (name: string, inDays: number, paid: number) => {
    const { data } = await sb
      .from("reservations")
      .insert({ agency_id: agency.agencyId, vehicle_id: car, client_id: await client(name), daily_price: 300, start_at: new Date(Date.now() + inDays * day).toISOString(), end_at: new Date(Date.now() + (inDays + 2) * day).toISOString() })
      .select("id")
      .single();
    if (paid) await sb.from("reservation_payments").insert({ agency_id: agency.agencyId, reservation_id: data!.id, amount: paid, method: "cash", kind: "advance" });
    return data!.id;
  };
  const dup = await book("Client Doublon", 10, 0);
  const paid = await book("Client Payé", 20, 300);
  const later = await book("Client Plus Tard", 30, 0);

  await login(page, agency.email, agency.password);
  await page.goto("/reservations");
  await tick(page, /Client Doublon/);
  await tick(page, /Client Payé/);
  await page.getByTestId("selection-bar").getByRole("button", { name: "Supprimer" }).click();
  await page.getByTestId("bulk-confirm").click();
  await expect(page.getByText("1 réservation supprimée.")).toBeVisible();
  await expect(page.getByText(/1 réservation gardée : contrat signé, location commencée ou argent reçu/)).toBeVisible();

  // Staff: cancel the two others in one go
  await page.context().clearCookies();
  await login(page, staff.email, staff.password);
  await page.goto("/reservations");
  await tick(page, /Client Payé/);
  await tick(page, /Client Plus Tard/);
  const bar = page.getByTestId("selection-bar");
  await expect(bar.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
  await bar.getByRole("button", { name: "Annuler" }).click();
  await page.getByTestId("bulk-confirm").click();
  await expect(page.getByText("Ce champ est obligatoire.")).toBeVisible(); // a reason is needed
  await page.getByLabel("Raison de l'annulation").fill("Le client a annulé");
  await page.getByTestId("bulk-confirm").click();
  await expect(page.getByText("2 réservations annulées.")).toBeVisible();

  const { data } = await sb.from("reservations").select("id, status").in("id", [dup, paid, later]).order("start_at");
  expect(data).toEqual([
    { id: paid, status: "cancelled" },
    { id: later, status: "cancelled" },
  ]);
});
