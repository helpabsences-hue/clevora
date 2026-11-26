import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/**
 * E2E tests against the real app + local Supabase (`npx supabase start`).
 * Three screen sizes, as required by CLAUDE.md.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
  },
  projects: [
    { name: "phone", use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "laptop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run start",
    // also serve the /dev/ui component page in the production build used by the tests
    env: { PARCOLIA_DEV_UI: "1", AI_PROVIDER: "mock", RATE_LIMIT_EXEMPT_IPS: "127.0.0.1,::1,::ffff:127.0.0.1,unknown" },
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
