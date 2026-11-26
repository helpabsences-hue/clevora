# Security

| Layer | What | Where |
|---|---|---|
| Tenant isolation | RLS on every table through `current_agency_ids()` / `writable_agency_ids()`; tested table by table | `supabase/migrations/*rls*`, `supabase/tests/database/002_*` |
| Roles | admin / staff enforced in RLS and SQL functions, UI hides the rest | `003_roles.test.sql` |
| Two-step login | TOTP (authenticator app) in Mon compte. With a verified factor the database closes the user's agencies until the session is AAL2 (`mfa_satisfied()`), and the proxy sends them to `/mfa` | `20261111100000_mfa.sql`, `src/lib/auth/mfa.ts`, `src/proxy.ts` |
| Rate limiting | Login (per address and per e-mail), password reset / magic link, signup, invitations, assistant. Hashed keys in `rate_limits`, service role only | `20261111090000_rate_limits.sql`, `src/lib/rate-limit.ts` |
| Headers | CSP (no framing, no plugins, own scripts only), HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, no `X-Powered-By` | `next.config.ts` |
| Secrets | Service role key only in server code (`server-only`); never `NEXT_PUBLIC_` | `src/lib/supabase/admin.ts` |
| Activity log | Insert-only journal (triggers + app events), readable by admins at `/activity` | `activity_log` |
| Privacy (loi 09-08) | `/privacy` policy page; per-client export and anonymization; retention (anonymize clients without rental for N years); agency deletion with files | `20261111110000_privacy.sql`, Paramètres › Données |
| Backups | Nightly encrypted dump (GitHub Actions) + Supabase backups | `.github/workflows/backup.yml`, `docs/RESTORE.md` |
| Monitoring | Sentry, off until `NEXT_PUBLIC_SENTRY_DSN` is set; no IP, cookies, bodies or e-mails are sent | `src/instrumentation*.ts`, `src/lib/monitoring.ts` |

`RATE_LIMIT_EXEMPT_IPS` exists only for the automated tests (they log in hundreds of times from one machine). It is ignored when `VERCEL_ENV=production`. Never set it on Vercel.
