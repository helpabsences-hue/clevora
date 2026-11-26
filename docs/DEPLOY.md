# Putting Parcolia online

The steps, in order. Each step says **where** to click. Nothing here needs code changes:
everything is configured with environment variables and dashboards.

> Never paste keys or passwords in a chat, an issue or a commit. They go only into
> the Supabase, Vercel and GitHub settings pages named below.

---

## 1. Domains: one or two?

| Option | App (logins, agencies) | Public site (home, prices) | Variables |
|---|---|---|---|
| **A. One domain** (simplest) | `https://parcolia.ma` | `https://parcolia.ma` | `NEXT_PUBLIC_SITE_URL=https://parcolia.ma`, `NEXT_PUBLIC_MARKETING_URL` empty |
| **B. Two domains** | `https://app.parcolia.ma` | `https://parcolia.ma` (+ `www`) | `NEXT_PUBLIC_SITE_URL=https://app.parcolia.ma`, `NEXT_PUBLIC_MARKETING_URL=https://parcolia.ma` |

With option B the app sends each page to the right domain automatically
(`src/lib/domains.ts`): `parcolia.ma/login` → `app.parcolia.ma/login`,
`app.parcolia.ma/` → the dashboard, `www.parcolia.ma` → `parcolia.ma`.
You can start with A and move to B later: only the variables and the domains in Vercel change.

---

## 2. Supabase: two projects

Create them on [supabase.com/dashboard](https://supabase.com/dashboard), region **Europe (Frankfurt or Paris)**:

- `parcolia-staging`: tests, previews. Fake data only.
- `parcolia-prod`: real agencies.

For **each** project, write down (in a password manager, not in a file of the repo):
the *project ref* (the `xxxx` in `https://xxxx.supabase.co`), the database password,
the `anon` key and the `service_role` key (Project Settings → API).

### 2.1 Tables (migrations)

Migrations are applied by GitHub (step 4). The first time, you can also do it by hand:

```bash
npx supabase login
npx supabase link --project-ref <prod ref>
npx supabase db push --remote
```

**Never** run `supabase db reset` or `seed.sql` on an online project.

### 2.2 Auth settings (each project)

Authentication → URL Configuration:

- **Site URL**: the app URL (`https://app.parcolia.ma` or `https://parcolia.ma`; staging: the Vercel staging URL).
- **Redirect URLs**: `https://app.parcolia.ma/**` (and `https://parcolia.ma/**` if option A).
  Staging: `https://*-<your-vercel-team>.vercel.app/**` for previews.

Authentication → Emails → Templates: for *Confirm signup*, *Reset password*, *Magic link*
and *Change email*, paste the HTML of `supabase/templates/confirmation.html`,
`recovery.html`, `magic_link.html`, `email_change.html`. Each template is already in
French, Arabic and English (it uses the language the user chose). Suggested subjects:
« Confirmez votre e-mail · Parcolia », « Nouveau mot de passe · Parcolia »,
« Votre lien de connexion · Parcolia », « Confirmez votre nouvel e-mail · Parcolia ».

Authentication → Emails → SMTP Settings: turn on **custom SMTP** with Resend (step 3).

Authentication → Multi-Factor: TOTP **enabled** (two-step login in Mon compte).

Authentication → Rate limits: keep the defaults; the app has its own limits too.

### 2.3 Storage

Storage → Settings: global file size limit **10 MB**. The buckets and their rules are created
by the migrations (`agency-logos` public, `agency-docs` private, every path starts with the agency id).

### 2.4 Database

- Project Settings → Database → **Connection pooling**: on (default). The app talks to
  Supabase over HTTPS, so it needs no pool settings; the nightly backup uses the
  *session pooler* string.
- When you move to **Pro**: Database → Backups → turn on **Point-in-Time Recovery**.
- Nightly encrypted backup to GitHub: see `docs/RESTORE.md` (secrets `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`).

### 2.5 Limits

Free plan: 500 MB database, 1 GB files, 50 000 monthly active users, 5 GB egress.
- The `/platform` page shows database, files and active users against the limits.
- The daily job emails every platform admin at **80 %** and **95 %**.
- Egress is not visible from the database: Organization → Usage, and on Pro set a
  **spend cap** or usage alerts there.
- On Pro, set `SUPABASE_LIMIT_DB_MB=8192`, `SUPABASE_LIMIT_STORAGE_GB=100`, `SUPABASE_LIMIT_MAU=100000` in Vercel.

---

## 3. Emails from no-reply@parcolia.ma (Resend)

1. [resend.com](https://resend.com) → Domains → **Add domain** `parcolia.ma` (region EU).
2. Resend shows DNS records. Add them where you bought the domain:
   - **SPF**: `TXT` on `send.parcolia.ma` → `v=spf1 include:amazonses.com ~all` (copy the exact value Resend shows)
   - **DKIM**: `TXT` on `resend._domainkey.parcolia.ma` → the long key Resend shows
   - **MX** on `send.parcolia.ma` (for bounces), as shown
   - **DMARC**: `TXT` on `_dmarc.parcolia.ma` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@parcolia.ma; adkim=s; aspf=s`
     (start with `p=none` for two weeks if you want to watch reports first)
3. Wait for **Verified**, then API Keys → create a key with *Sending access*.
4. Use it twice:
   - Supabase Auth SMTP: host `smtp.resend.com`, port `465`, user `resend`, password = the key, sender `no-reply@parcolia.ma`, name `Parcolia`.
   - Vercel variables: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=resend`, `SMTP_PASSWORD=<key>`, `EMAIL_FROM="Parcolia <no-reply@parcolia.ma>"`.
5. Test: sign up with a Gmail address and check "Show original": SPF, DKIM and DMARC must say **PASS**.

---

## 4. GitHub: CI and migrations

Workflows in `.github/workflows/`:

| File | When | What |
|---|---|---|
| `ci.yml` | every pull request and push to `main` | lint, types, translations, unit tests, RLS tests on a local Supabase, build, Playwright at 375 / 768 / 1280 px |
| `db-deploy.yml` | push to `main` → **staging**; tag `v*` → **production** | `supabase db push` (never the seed) |
| `backup.yml` | every night | encrypted dump of production |

GitHub → Settings → Secrets and variables → Actions → **New repository secret**:
`SUPABASE_ACCESS_TOKEN` (supabase.com/dashboard/account/tokens), `STAGING_PROJECT_REF`,
`STAGING_DB_PASSWORD`, `PRODUCTION_PROJECT_REF`, `PRODUCTION_DB_PASSWORD`,
`SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`.

GitHub → Settings → Environments → **production** → *Required reviewers*: add yourself, so
every production migration waits for your click.

GitHub → Settings → Branches → rule on `main`: *Require status checks* → `CI`.

**Releasing**: merge to `main` (staging gets the migrations), check staging, then
create a release with a tag like `v1.0.0` (production gets the migrations), and promote
the deployment in Vercel (step 5).

---

## 5. Vercel

1. [vercel.com/new](https://vercel.com/new) → import the GitHub repository → framework **Next.js**.
2. Project → Settings → Environment Variables. Use **Production** for the prod Supabase and
   **Preview** for staging. Every variable is explained in `.env.example`:

   | Variable | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | prod project | staging project |
   | `NEXT_PUBLIC_SITE_URL` | app URL | staging URL |
   | `NEXT_PUBLIC_MARKETING_URL` | option B only | empty |
   | `SMTP_*`, `EMAIL_FROM` | Resend | Resend |
   | `CRON_SECRET` | a long random string | another one |
   | `GROQ_API_KEY` (assistant, free models with fallback) or `ANTHROPIC_API_KEY` | yes | optional |
   | `PARCOLIA_*` (legal, bank, privacy) | yes | yes |
   | `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_CNDP_NUMBER` | yes | — |
   | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | yes | DSN only |

   Never set `AI_PROVIDER`, `PARCOLIA_DEV_UI` or `RATE_LIMIT_EXEMPT_IPS` on Vercel (tests only).
3. Settings → Domains: add `app.parcolia.ma` (option B) and/or `parcolia.ma` and `www.parcolia.ma`;
   create the DNS records Vercel shows (`CNAME` for `app`/`www`, `A` for the apex).
4. Settings → Git: production branch `main`. Pull requests get preview URLs automatically.
5. Analytics → **Enable Web Analytics** (no cookies; the app already includes it).
6. The daily job (`vercel.json`, 07:00 UTC) sends alerts, creates monthly recurring charges
   and checks Supabase usage. Vercel adds the `CRON_SECRET` header itself.

---

## 6. Monitoring

- **Sentry**: create a Next.js project, copy the DSN to `NEXT_PUBLIC_SENTRY_DSN`. With
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` set, each Vercel build creates a
  release named after the git commit and uploads source maps (then deletes them from the site).
  No personal data is sent (`src/lib/monitoring.ts`).
- **Vercel Analytics**: page views and Web Vitals, cookieless.
- **Supabase usage**: `/platform` + the 80 % / 95 % emails (section 2.5).

---

## 7. Demo agency on production

```bash
# .env.production.local (ignored by git): prod NEXT_PUBLIC_SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD
npm run demo:create
```

It creates **one** agency "Agence Démo" (8 cars, 15 fake clients, 3 months of activity,
credits) with `demo@parcolia.ma` (admin) and `demo-staff@parcolia.ma` (staff). It refuses to
run if the agency already exists and never touches other agencies.

## 8. Your owner account (Parcolia console)

1. Sign up normally on the site with your email and a strong password.
2. On your computer, with the PRODUCTION keys in `.env.production.local`:
   ```bash
   npm run platform:admin -- you@example.com --prod
   ```
3. Log in: you land on `/platform` (Tableau de bord, Agences, Utilisateurs, Paiements, Forfaits).
   If you also run an agency, use the user menu → « Espace Parcolia ».
4. Turn on two-step login in « Mon compte ». Add other Parcolia admins from /platform/users.

Next: the launch checklist in `docs/LAUNCH.md`.
