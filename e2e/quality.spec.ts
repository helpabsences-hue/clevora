import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO, expectNoHorizontalScroll, login } from "./helpers";

const PUBLIC = ["/", "/login", "/signup", "/forgot-password", "/privacy"];
const APP = ["/dashboard", "/reservations", "/reservations/new", "/contracts", "/planning", "/fleet", "/insurance", "/oil", "/charges", "/statistics", "/assistant", "/team", "/activity", "/settings", "/settings?section=data", "/billing", "/account"];

/** Accessibility (WCAG 2.1 AA, serious and critical), page errors (incl. hydration), no sideways scroll. */
async function check(page: import("@playwright/test").Page, path: string, errors: string[]) {
  errors.length = 0;
  await page.goto(path, { waitUntil: "networkidle" });
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(serious, `${path} accessibility`).toEqual([]);
  expect(errors, `${path} page errors`).toEqual([]);
  await expectNoHorizontalScroll(page);
}

test("every page: accessible, no page errors, no sideways scroll", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  // A text missing in the browser shows up as MISSING_MESSAGE in the console
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("MISSING_MESSAGE")) errors.push(m.text().slice(0, 200));
  });
  for (const path of PUBLIC) await check(page, path, errors);
  await login(page, DEMO.admin.email, DEMO.admin.password);
  for (const path of APP) await check(page, path, errors);
});
