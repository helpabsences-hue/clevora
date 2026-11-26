import { expect, test } from "@playwright/test";
import { createTestAgency, login } from "./helpers";

test("installable app: manifest, icons, service worker, offline page", async ({ page, context, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Parcolia", display: "standalone", start_url: "/dashboard" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);

  const agency = await createTestAgency();
  await login(page, agency.email, agency.password);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Pages are never served from the cache: offline → the offline page, not old private data
  await context.setOffline(true);
  await page.goto("/fleet").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Pas de connexion Internet" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: /Réessayer/ }).click();
  await expect(page.getByRole("heading", { name: "Parc auto", level: 1 })).toBeVisible();
});
