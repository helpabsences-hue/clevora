# Launch checklist

Tick every line before opening Parcolia to real agencies. How-tos are in `docs/DEPLOY.md`.

## Infrastructure
- [ ] Domain bought; DNS records for Vercel added and verified (`app.` / apex / `www`).
- [ ] Supabase **prod** and **staging** projects created in Europe; migrations applied (`db-deploy.yml` green).
- [ ] Supabase Auth: Site URL, redirect URLs, the 4 email templates, custom SMTP (Resend), TOTP enabled.
- [ ] Resend domain **verified**; a test email shows SPF, DKIM and DMARC = PASS.
- [ ] Vercel production variables set (compare with `.env.example`); no test-only variable on Vercel.
- [ ] Vercel Cron visible (Settings → Cron Jobs) and one manual run returned 200.
- [ ] GitHub secrets set (the migrations job says « secrets are not set yet: skipping » until then); `production` environment needs your approval; `main` requires CI.
- [ ] CI green on the last commit of `main` (GitHub → Actions → CI).

## Safety
- [ ] RLS tests green in CI (`npx supabase test db`): 400+ tests, 0 failures.
- [ ] Nightly backup ran at least once (GitHub → Actions → Database backup).
- [ ] **Backup verified with a test restore** into a scratch project (`docs/RESTORE.md`); dates and counts checked.
- [ ] Point-in-Time Recovery turned on (when on Supabase Pro).
- [ ] Sentry receives a test error from production (and the release shows the commit).
- [ ] `/platform` shows Supabase usage under 80 %.

## Legal (Morocco)
- [ ] Privacy page filled: `PARCOLIA_LEGAL_NAME`, address, ICE, RC, `PARCOLIA_DATA_REGION`, privacy email.
- [ ] Contract terms (Conditions générales) reviewed for the demo agency.
- [ ] **CNDP declaration** (loi 09-08) filed; number set in `NEXT_PUBLIC_CNDP_NUMBER`.
- [ ] Invoices: legal mentions and bank details (`PARCOLIA_BANK_*`) correct on a test invoice PDF.

## Business
- [ ] Pricing set in the `plans` table (prices TTC, yearly = 10 months, limits, AI questions).
- [ ] Platform admin account created (`platform_admins`), with two-step login turned on.
- [ ] Demo agency ready (`npm run demo:create`); demo logins tested on phone and laptop.
- [ ] Support WhatsApp number on the site (`NEXT_PUBLIC_SUPPORT_WHATSAPP`).
- [ ] `GROQ_API_KEY` set on Vercel (a NEW key: the one pasted in a chat must be deleted on console.groq.com), one assistant question answered in production. Optional: `ANTHROPIC_API_KEY`.

## Last check (30 minutes, on a phone and on a laptop)
- [ ] Sign up a new agency → confirm email → add a car → reservation → contract PDF → return → payment.
- [ ] Invite a staff member by email and WhatsApp; staff cannot see Charges, Statistiques or money.
- [ ] Arabic: menu on the right, dates and amounts in the right order, contract PDF readable.
- [ ] Inspection (if you sell it): turn it on in Paramètres, do a departure and a return on a phone (photos and video), open the état des lieux PDF.
- [ ] Scan a real CIN and a real passport in Clients (the text must fill the form).
- [ ] Light and dark themes look right; no sideways scrolling.
