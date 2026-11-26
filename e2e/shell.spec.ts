import { expect, test } from "@playwright/test";
import { admin, DEMO, expectNoHorizontalScroll, login } from "./helpers";

const PAGES = [
  "/dashboard", "/reservations", "/reservations/new", "/contracts", "/planning", "/fleet",
  "/insurance", "/oil", "/charges", "/statistics", "/assistant", "/team", "/settings", "/account", "/dev/ui",
];

test("the right navigation for each screen size", async ({ page }, testInfo) => {
  await login(page, DEMO.admin.email, DEMO.admin.password);
  const bottom = page.getByRole("navigation", { name: "Navigation principale" }).filter({ has: page.getByRole("link", { name: "Nouvelle réservation" }) });
  const side = page.getByRole("complementary", { name: "Navigation principale" });

  if (testInfo.project.name === "phone") {
    await expect(bottom).toBeVisible();
    await expect(side).toBeHidden();
    // "Plus" opens the other pages
    await page.getByRole("button", { name: "Plus" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Assurance" }).click();
    await page.waitForURL(/\/insurance/);
    await expect(page.getByRole("dialog")).toBeHidden();
  } else if (testInfo.project.name === "tablet") {
    await expect(bottom).toBeHidden();
    await expect(side).toBeVisible();
    // icon rail: labels hidden until it is opened over the content
    await expect(side.getByText("Vidange", { exact: true })).not.toBeInViewport();
    await side.getByRole("button", { name: "Ouvrir le menu" }).click();
    await side.getByRole("link", { name: "Vidange" }).click();
    await page.waitForURL(/\/oil/);
  } else {
    await expect(bottom).toBeHidden();
    await expect(side.getByRole("link", { name: "Statistiques" })).toBeVisible();
    await expect(side.getByText("Propulsé par Parcolia")).toBeVisible();
    await side.getByRole("link", { name: "Planning" }).click();
    await page.waitForURL(/\/planning/);
    await expect(side.getByRole("link", { name: "Planning" })).toHaveAttribute("aria-current", "page");
  }
});

test("urgent counts are shown as badges", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "badges sit in the sidebar / rail");
  // Late returns in the demo agency right now (depends on the time of day)
  const { data: agency } = await admin().from("agencies").select("id").eq("slug", "agence-demo").single();
  const { count } = await admin()
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agency!.id)
    .eq("status", "on_rental")
    .lt("end_at", new Date().toISOString());
  expect(count).toBeGreaterThan(0);
  await login(page, DEMO.admin.email, DEMO.admin.password);
  const reservations = page.getByRole("complementary").getByRole("link", { name: /Réservations/ });
  await expect(reservations).toHaveText(`Réservations${count}`);
});

test("staff do not see admin pages in the navigation", async ({ page }, testInfo) => {
  await login(page, DEMO.staff.email, DEMO.staff.password);
  if (testInfo.project.name === "phone") await page.getByRole("button", { name: "Plus" }).click();
  const scope = testInfo.project.name === "phone" ? page.getByRole("dialog") : page.getByRole("complementary");
  await expect(scope.getByRole("link", { name: "Paramètres" })).toBeAttached();
  for (const name of ["Charges", "Statistiques", "Équipe"]) {
    await expect(scope.getByRole("link", { name })).toHaveCount(0);
  }
  await page.goto("/charges");
  await page.waitForURL(/\/dashboard/);
});

test("no page scrolls sideways (fr and ar)", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, DEMO.admin.email, DEMO.admin.password);
  for (const prefix of ["", "/ar"]) {
    for (const path of PAGES) {
      await page.goto(prefix + path);
      await expect(page.locator("main")).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  }
});

test("light / dark switch in the header is saved in the profile", async ({ page }) => {
  const { createTestAgency, login, admin } = await import("./helpers");
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.getByTestId("mode-toggle").click(); // one tap: light -> dark
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(async () => (await admin().from("profiles").select("preferred_theme").eq("id", agency.userId).single()).data?.preferred_theme)
    .toBe("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("language menu in the header: same page in Arabic (RTL), saved in the profile", async ({ page }) => {
  const { createTestAgency, login, admin } = await import("./helpers");
  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.goto("/fleet");
  const sw = page.getByTestId("language-switch").first();
  await sw.getByRole("button", { name: /Langue/ }).click();
  await page.getByRole("menuitem", { name: "العربية" }).click();
  await page.waitForURL(/\/ar\/fleet/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect
    .poll(async () => (await admin().from("profiles").select("preferred_locale").eq("id", agency.userId).single()).data?.preferred_locale)
    .toBe("ar");
});
