# Parcolia — database

All schema changes are Supabase migrations in `supabase/migrations/`. Never edit the database by hand.

| File | Content |
|---|---|
| `…090000_extensions_and_helpers.sql` | btree_gist, pg_trgm, vector; `set_updated_at()` (also forbids changing `agency_id`) |
| `…090100_core_tables.sql` | plans, agencies, profiles, agency_members, invitations, platform_admins |
| `…090200_business_tables.sql` | vehicles, maintenance_periods, clients, reservations (no double booking), reservation_payments, charges, ai_documents, ai_chunks, activity_log |
| `…090300_security_functions.sql` | `current_agency_ids()`, `is_member()`, `has_role()`, `is_platform_admin()` |
| `…090400_business_functions.sql` | `next_contract_number()`, `preview_contract_number()`, `create_agency()`, `accept_invitation()`, `match_chunks()` |
| `…090500_triggers.sql` | updated_at, profiles on signup, billing guard, last-admin guard, staff car-field guard, plan car limit, contract numbers, advance sync, activity log |
| `…090600_rls_policies.sql` | RLS on every table |
| `…090700_storage.sql` | buckets `agency-logos` (public) and `agency-docs` (private) + policies |
| `…090800_default_plans.sql` | Essentiel / Pro / Illimité (placeholder prices, editable in the table) |
| `…120000_auth_onboarding.sql` | `profiles.email`, `create_agency(name, slug, city, phone, colour)`, `create_agency_for_user` (service role), `invitation_preview(token)`, read-only mode (`writable_agency_ids()` in every write policy) |

## Roles

- **admin** (agency owners, all equal): everything in their agency. Cannot change billing fields (`plan_id`, `subscription_status`, `trial_ends_at`, `current_period_end`): only Parcolia platform admins, the service role or SECURITY DEFINER functions can.
- **staff**: reads the agency's data except charges, invitations and the activity log; creates and edits clients, reservations, payments and maintenance; on cars, may only change km, vidange, assurance, visite technique and notes; never deletes.
- The last active admin of an agency can never be removed, disabled or demoted. Nobody can change their own role or status.
- **Read-only mode**: when the trial or paid period is over, or the agency is suspended/cancelled, every write (tables and storage) is refused; reads keep working. `past_due` stays writable (grace period).

## Things the app must know

- `reservations.contract_number`: send `''` (or nothing) to get the next number. Show `preview_contract_number(agency)` as the placeholder; it does not consume a number.
- `reservations.advance_paid` is recomputed from `reservation_payments` (kind `advance`). Record the avance as a payment.
- Double booking raises SQLSTATE `23P01` (constraint `reservations_no_double_booking`).
- Plan limits raise `P0001` with hint `plan_limit_vehicles` / `plan_limit_users`; last-admin raises `P0001` with hint `last_admin`.
- Invitation tokens: generate a random token, store `encode(sha256(token), 'hex')` in `token_hash`, put the raw token in the email link, then call `accept_invitation(token)`.
- Storage paths: `agency-logos/{agency_id}/logo.png`, `agency-docs/{agency_id}/…`. Receipts go in `agency-docs/{agency_id}/charges/…` (admins only).

## Tests

`supabase/tests/database/*.test.sql` (pgTAP):

- `001` every table has RLS and policies; every table with `agency_id` is covered by the isolation tests; anonymous visitors see only plans.
- `002` a user of agency A (admin and staff) cannot read, update, delete or insert any row of agency B in every table; agency B's data fingerprint is unchanged afterwards.
- `003` staff cannot see charges, the activity log or invitations, or change protected car fields; admins cannot change billing.
- `004` double booking, contract numbering, advance sync, activity log, normalised plate/CIN, last admin, create_agency, invitations, plan limit.
- `005` storage isolation by agency folder; receipts are admin-only.
- `006` profile emails, agency creation, invitation preview, read-only mode.

Run them on the local Supabase (`npx supabase start` first):

```bash
npm run db:test
```

Without Docker (needs Postgres 15+ with pgvector, pgtap and `pg_prove`):

```bash
npm run db:test:nodocker
```

`scripts/db/supabase-shim.sql` is a **test-only** stand-in for Supabase's `auth` and `storage` schemas. Never apply it to a real project.

## Types

```bash
npm run db:types
```

This writes `src/types/database.ts`. Run it after every migration.

## Seed (local / staging only — never production)

`supabase/seed.sql` creates "Agence Démo" (12 cars, 25 fake clients, 40 reservations from −90 to +14 days, 6 months of charges). Local demo logins:

- `admin@demo.parcolia.ma` / `Demo-Parcolia-2026`
- `staff@demo.parcolia.ma` / `Demo-Parcolia-2026`
