# Parcolia

Multi-tenant SaaS for car rental agencies in Morocco. Project rules: [CLAUDE.md](CLAUDE.md) · database: [docs/DATABASE.md](docs/DATABASE.md).

## Run it on your computer

You need **Git**, **Node.js 22**, and **Docker Desktop** (open and running).

```bash
npm install
```

```bash
npx supabase start
```

If `supabase start` stops with "Data limit exceeded", use Docker Hub instead (PowerShell):

```bash
$env:SUPABASE_INTERNAL_IMAGE_REGISTRY="docker.io"; npx supabase start
```

Create `.env.local` from `.env.example`, then paste the two keys printed by `npx supabase status` (`ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`). These local keys are not secret; never commit real production keys.

```bash
npm run dev
```

Open http://localhost:3000 and log in with the demo accounts (local only):

| Role  | Email                 | Password          |
|-------|-----------------------|-------------------|
| admin | admin@demo.parcolia.ma | Demo-Parcolia-2026 |
| staff | staff@demo.parcolia.ma | Demo-Parcolia-2026 |

Emails sent by the app (invitations, password reset, magic links) arrive in the local mailbox: http://127.0.0.1:54324. The database is at http://127.0.0.1:54323 (Supabase Studio).

## Checks (run before saying a task is done)

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run db:test
```

```bash
npm run i18n:check
```

```bash
npm run build
```

```bash
npm run test:e2e
```

`test:e2e` runs Playwright at 375 px, 768 px and 1280 px against `npm run start` (build first) and the local Supabase.

## Project layout

- `src/app/[locale]/(auth)` — login, signup (3 steps), password reset, invitation (Parcolia branding)
- `src/app/[locale]/(app)` — inside an agency: dashboard, team, account, billing (agency branding)
- `src/app/auth/confirm` — landing route for links in Supabase emails
- `src/proxy.ts` — locale prefix, session refresh, login redirects (Next.js 16 "proxy" = old middleware)
- `src/lib/auth` — `getActiveAgency()`, `requireUser/requireAgency/requireRole`, server-action guard
- `src/components/ui` — shadcn/ui-style components (Radix): buttons, fields (date, time, MAD, matricule, phone), Oui/Non, dialogs
- `src/components/app` — Parcolia components: shell (sidebar / rail / bottom nav), ResponsiveList, UrgencyGroups, StatTile, EmptyState, Stepper, SearchBar, `<Ltr>`
- `/dev/ui` — every shared component in one page (development only, or with `PARCOLIA_DEV_UI=1`)
- `messages/{fr,ar,en}.json` — all texts; `supabase/` — migrations, seed, email templates, pgTAP tests
- `src/lib/ai` — Assistant IA: tools (each runs with the user's own session, so RLS applies; staff never get money tools), Claude provider (`claude-opus-5-5`, streaming tool loop), offline mock (`AI_PROVIDER=mock`, tests only)

## Assistant IA

- Set `ANTHROPIC_API_KEY` (server only) in `.env.local` and on Vercel. Without it the page says the assistant is not connected yet.
- Included in the Pro (300 questions / month) and Illimité (1 500) plans; admins can switch it off per agency (`agencies.ai_enabled`).
- Nothing of the conversation is stored. One `activity_log` row per question keeps only the tools used and token counts.
- Admins add agency documents (règlement, conditions, tarifs) as text; the assistant searches them (Postgres full-text search, `search_chunks`) and cites them.

## Abonnement, espace Parcolia

- `/billing` (admins): plan, usage, choose a plan → pending payment with a reference (works even in read-only mode). Payment provider interface in `src/lib/billing/provider.ts` (manual today). Bank details from `PARCOLIA_*` variables.
- `/platform` (Parcolia staff, `public.platform_admins`; 404 for everyone else): all agencies, confirm payments (creates invoice `F-YYYY-NNNNN`, activates the plan), change plan/status/dates. Local demo: `platform@demo.parcolia.ma` / `Demo-Parcolia-2026`.
- Invoices: `/api/invoices/{id}` PDF, generated on demand (TVA 20 % included in prices).
- `/` marketing page with prices read from the `plans` table.

## Security

See `docs/SECURITY.md` (isolation, roles, two-step login, rate limiting, headers, privacy, backups, monitoring) and `docs/RESTORE.md` (backups and restore).

## Usability

See `docs/UX.md` (taps per task, checks, installable app).
