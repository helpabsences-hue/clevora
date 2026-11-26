import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

export const DEMO = {
  admin: { email: "admin@demo.parcolia.ma", password: "Demo-Parcolia-2026" },
  staff: { email: "staff@demo.parcolia.ma", password: "Demo-Parcolia-2026" },
  agencyName: "Agence Démo",
};

export const PASSWORD = "Test-Parcolia-2026";

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Service-role client for test setup only. */
export function admin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A fresh agency with its admin (confirmed account), created through the real SQL function. */
export async function createTestAgency(options: { name?: string; trialEnded?: boolean } = {}) {
  const sb = admin();
  const id = uid();
  const email = `owner-${id}@test.parcolia.ma`;
  const name = options.name ?? `Agence Test ${id}`;
  const { data: user, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Owner ${id}`, locale: "fr" },
  });
  if (error || !user.user) throw error ?? new Error("createUser failed");
  const { data: agencyId, error: rpcError } = await sb.rpc("create_agency_for_user", {
    p_user: user.user.id,
    p_name: name,
    p_slug: `test-${id}`,
  });
  if (rpcError || !agencyId) throw rpcError ?? new Error("create_agency_for_user failed");
  if (options.trialEnded) {
    await sb.from("agencies").update({ trial_ends_at: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", agencyId);
  }
  return { agencyId, name, email, password: PASSWORD, userId: user.user.id };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

/** CLAUDE.md: no horizontal page scroll at any size. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}

/** Opens the user menu in the header (works at every size). */
export async function openUserMenu(page: Page) {
  await page.getByRole("button", { name: "Ouvrir le menu du compte" }).click();
}

/** Latest email sent to `to`, read from the local Supabase mailbox (Mailpit). */
export async function latestEmailHtml(to: string): Promise<string> {
  const base = "http://127.0.0.1:54324/api/v1";
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${base}/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const id = search?.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${base}/message/${id}`).then((r) => r.json());
      return message.HTML as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}

/** Adds a confirmed user with a role to an existing agency (test setup). */
export async function addMember(agencyId: string, role: "admin" | "staff") {
  const sb = admin();
  const id = uid();
  const email = `${role}-${id}@test.parcolia.ma`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `${role} ${id}`, locale: "fr" },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const { error: memberError } = await sb.from("agency_members").insert({ agency_id: agencyId, user_id: data.user.id, role });
  if (memberError) throw memberError;
  return { email, password: PASSWORD, userId: data.user.id };
}

/** Inserts a car directly (test setup). */
export async function addVehicle(agencyId: string, values: { plate: string; brand_model?: string; daily_rate?: number }) {
  const { data, error } = await admin()
    .from("vehicles")
    .insert({
      agency_id: agencyId,
      plate: values.plate,
      brand_model: values.brand_model ?? "Dacia Logan",
      category: "economy",
      fuel: "diesel",
      gearbox: "manuelle",
      daily_rate: values.daily_rate ?? 250,
      current_km: 40000,
      insurance_expires_on: "2099-01-01",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert vehicle failed");
  return data.id;
}

/** A Parcolia staff account (public.platform_admins), with no agency. */
export async function createPlatformAdmin() {
  const sb = admin();
  const email = `parcolia-${uid()}@test.parcolia.ma`;
  const { data, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Équipe Parcolia" } });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const { error: e2 } = await sb.from("platform_admins").insert({ user_id: data.user.id });
  if (e2) throw e2;
  return { email, password: PASSWORD, userId: data.user.id };
}
