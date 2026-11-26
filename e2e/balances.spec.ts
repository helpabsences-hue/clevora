import { expect, test } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

async function setup() {
  const agency = await createTestAgency();
  const staff = await addMember(agency.agencyId, "staff");
  const sb = admin();
  const car1 = await addVehicle(agency.agencyId, { plate: `B${uid().slice(-5).toUpperCase()}-A-6`, brand_model: "Dacia Logan", daily_rate: 300 });
  const car2 = await addVehicle(agency.agencyId, { plate: `B${uid().slice(-5).toUpperCase()}-B-6`, brand_model: "Peugeot 208", daily_rate: 400 });
  const client = async (full_name: string, phone: string) =>
    (await sb.from("clients").insert({ agency_id: agency.agencyId, full_name, phone, id_type: "cin", id_number: `BL${Math.floor(100000 + Math.random() * 899999)}` }).select("id").single()).data!.id;
  const day = 86_400_000;
  const now = Date.now(); // one base time: exact whole days
  const mk = async (vehicle_id: string | null, client_id: string, startDays: number, endDays: number, status: string, paid: number) => {
    const start = new Date(now + startDays * day).toISOString();
    const { data } = await sb
      .from("reservations")
      .insert({
        agency_id: agency.agencyId,
        vehicle_id,
        client_id,
        start_at: start,
        end_at: new Date(now + endDays * day).toISOString(),
        daily_price: 300,
        status,
        signed_at: status === "reserved" ? null : start,
        actual_return_at: status === "returned" ? new Date(now + endDays * day).toISOString() : null,
      })
      .select("id")
      .single();
    if (paid) await sb.from("reservation_payments").insert({ agency_id: agency.agencyId, reservation_id: data!.id, amount: paid, method: "cash", kind: "advance" });
    return data!.id;
  };
  const returned = await mk(car1, await client("Samir Retard", "+212600000201"), -10, -7, "returned", 300); // 3 days = 900, owes 600
  await mk(car2, await client("Nadia EnCours", "+212600000202"), -1, 2, "on_rental", 500); // 900, owes 400
  await mk(null, await client("Futur Client", "+212600000203"), 20, 22, "reserved", 0); // not started: not a debt
  await mk(car1, await client("Bon Payeur", "+212600000204"), -20, -18, "returned", 600); // paid in full
  return { agency, staff, returned };
}

test("Restes à payer: who owes what, returned rentals first, collect in one tap; the total is in Statistiques", async ({ page }) => {
  const s = await setup();
  await login(page, s.staff.email, s.staff.password);
  await page.goto("/balances");
  await expect(page.getByTestId("balances-total")).toContainText("1 000 MAD");
  await expect(page.getByTestId("balances-total")).toContainText("2 clients");
  const rows = page.getByTestId("balance-row").filter({ visible: true });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Samir Retard");
  await expect(rows.nth(0)).toContainText("600 MAD");
  await expect(rows.nth(1)).toContainText("Nadia EnCours");
  await expect(page.getByText("Futur Client")).toHaveCount(0);
  await expect(page.getByText("Bon Payeur")).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  await rows.nth(0).getByRole("link", { name: "Encaisser" }).click();
  await page.waitForURL(new RegExp(`/reservations/${s.returned}\\?do=payment`));
  await expect(page.getByRole("dialog")).toBeVisible();

  // Admin: the same total on Statistiques, linking back here
  await page.context().clearCookies();
  await login(page, s.agency.email, s.agency.password);
  await page.goto("/statistics");
  await expect(page.getByTestId("stats-credit")).toContainText("1 000 MAD");
  const tile = page.getByRole("link", { name: /Crédit clients/ });
  await expect(tile).toContainText("2 clients doivent encore payer");
  await tile.click();
  await page.waitForURL(/\/balances$/);
});
