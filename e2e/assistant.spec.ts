import { expect, test } from "@playwright/test";
import { addMember, addVehicle, admin, createTestAgency, expectNoHorizontalScroll, login, uid } from "./helpers";

// The e2e server runs with AI_PROVIDER=mock: tools run for real (RLS included),
// only the language model is replaced by a keyword picker.

test("staff: asks about vidange, gets an answer with sources; money questions are refused", async ({ page }) => {
  const agency = await createTestAgency();
  const plate = `AI${uid().slice(-4).toUpperCase()}-A-6`;
  const carId = await addVehicle(agency.agencyId, { plate, brand_model: "Renault Clio" });
  await admin().from("vehicles").update({ current_km: 60000, oil_next_km: 60500 }).eq("id", carId);
  const staff = await addMember(agency.agencyId, "staff");
  await login(page, staff.email, staff.password);
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "Assistant IA" })).toBeVisible();
  await expect(page.getByTestId("assistant-docs")).toHaveCount(0); // staff cannot manage documents
  await expectNoHorizontalScroll(page);

  await page.getByTestId("assistant-suggestion").filter({ hasText: "vidange" }).click();
  const answer = page.getByTestId("assistant-answer").last();
  await expect(answer).toContainText("oil_due");
  await expect(answer).toContainText(plate);
  await expect(answer.getByTestId("assistant-sources").getByRole("link", { name: "Vidange" })).toBeVisible();

  await page.getByLabel("Votre question").fill("Quel est mon chiffre d'affaires ce mois-ci ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByTestId("assistant-answer").last()).toContainText("Seuls les administrateurs");
  await expectNoHorizontalScroll(page);

  // Straight to the API: still no revenue tool for staff
  const res = await page.request.post("/api/assistant", { data: { question: "chiffre d'affaires", history: [] } });
  expect(res.status()).toBe(200);
  expect(await res.text()).not.toContain('"name":"revenue"');

  // Privacy: one log row per question, tools only, never the text
  const { data: logs } = await admin().from("activity_log").select("details").eq("agency_id", agency.agencyId).eq("action", "assistant.question");
  expect(logs?.length).toBeGreaterThanOrEqual(2);
  expect(JSON.stringify(logs)).not.toContain("chiffre");
  expect(JSON.stringify(logs)).toContain("oil_due");
});

test("admin: answers come from the agency's own database (summary + tools), never from another agency", async ({ page }) => {
  const agency = await createTestAgency();
  const other = await createTestAgency();
  // Letters only: a tag like "2S1" would look like a number plate to the offline stand-in.
  const tag = uid().replace(/[^a-z]/g, "").slice(-5).toUpperCase().padEnd(5, "X");
  const plate = `${uid().replace(/\D/g, "").slice(-5).padStart(5, "1")}-A-6`;
  await addVehicle(agency.agencyId, { plate, brand_model: "Renault Megane" });
  await admin().from("agencies").update({ default_deposit: 7777 }).eq("id", agency.agencyId);
  // A client that exists ONLY in the other agency
  await admin().from("clients").insert({ agency_id: other.agencyId, full_name: `Secret ${tag}`, id_type: "cin", id_number: `SC${tag}` });
  await admin().from("clients").insert({ agency_id: agency.agencyId, full_name: `Mine ${tag}`, id_type: "cin", id_number: `MN${tag}`, phone: "+212611112222" });

  await login(page, agency.email, agency.password);
  await page.goto("/assistant");
  await expect(page.getByTestId("assistant-docs")).toHaveCount(0); // no documents needed
  await expectNoHorizontalScroll(page);
  const ask = async (q: string) => {
    const answers = page.getByTestId("assistant-answer");
    const before = await answers.count();
    await page.getByLabel("Votre question").fill(q);
    await page.keyboard.press("Enter");
    // Wait for THIS question's answer to exist and finish streaming.
    await expect(answers).toHaveCount(before + 1);
    const answer = answers.nth(before);
    await expect(answer.getByRole("status")).toHaveCount(0);
    return answer;
  };

  // 1. The retrieved summary of this agency's data
  await expect(await ask("Bonjour, combien de voitures ?")).toContainText("Parc : 1 voitures actives");
  // 2. Agency rules come from Paramètres, not from a document
  await expect(await ask("Quelle est la caution ?")).toContainText("7 777 MAD");
  // 3. Clients: only this agency's
  await expect(await ask(`client mine ${tag.toLowerCase()}`)).toContainText(`Mine ${tag}`);
  const secret = await ask(`client secret ${tag.toLowerCase()}`);
  await expect(secret).toContainText('"found":0');
  await expect(secret).not.toContainText(`Secret ${tag}`);
  // 4. A car's history
  await expect(await ask(`historique de la ${plate}`)).toContainText("Renault Megane");
  // 5. Revenue works for admins
  await expect(await ask("Mon chiffre d'affaires ?")).toContainText("chiffre_affaires");
});

test("assistant switched off, or not in the plan", async ({ page }) => {
  const agency = await createTestAgency();
  await admin().from("agencies").update({ ai_enabled: false }).eq("id", agency.agencyId);
  await login(page, agency.email, agency.password);
  await page.goto("/assistant");
  await expect(page.getByText("L'assistant IA est désactivé")).toBeVisible();
  const off = await page.request.post("/api/assistant", { data: { question: "bonjour" } });
  expect(off.status()).toBe(403);

  const { data: plan } = await admin().from("plans").select("id").eq("code", "essentiel").single();
  await admin().from("agencies").update({ ai_enabled: true, plan_id: plan!.id }).eq("id", agency.agencyId);
  await page.reload();
  await expect(page.getByText("L'assistant IA n'est pas inclus dans votre forfait")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir les forfaits" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
