# Parcolia — project context

## Product
Parcolia is a multi-tenant SaaS for car rental agencies in Morocco. One app, one database; each agency (tenant) sees only its own data and works under its own name and logo. Brand name in the UI: "Parcolia". In code, folders, packages and domains: "parcolia" (no accent).
Users: agency admins (the owners) and staff working at a desk or on a phone in the parking lot. Many are not technical. EASY TO USE is the top priority: few clicks, big clear buttons, plain words, no jargon.

## Stack
- Next.js (App Router, latest stable) + TypeScript (strict) + React Server Components where sensible
- Tailwind CSS + shadcn/ui (Radix) + lucide-react icons
- Supabase: Postgres, Auth, Storage, Row Level Security, pgvector, Edge Functions
- @supabase/ssr for auth in Next.js; supabase CLI migrations in /supabase/migrations (never edit the DB by hand)
- next-intl for i18n: fr (default), ar (RTL), en
- next-themes for light/dark
- react-hook-form + zod for every form; zod schemas shared between client and server
- TanStack Query only where client-side caching is needed; prefer server actions
- PDF: @react-pdf/renderer, generated on demand, never stored
- Charts: Recharts
- Tests: Vitest (logic) + Playwright (e2e, at 375px, 768px, 1280px)
- Deploy: Vercel

## Multi-tenancy rules (never break these)
- Every business table has agency_id uuid not null references agencies(id).
- RLS is enabled on EVERY table. Policies check membership through a SECURITY DEFINER function current_agency_ids() / has_role(agency_id, role). Never trust an agency_id sent by the client.
- The service role key is used only in server code and Edge Functions, never in the browser.
- Storage paths always start with the agency id: {agency_id}/logo.png, {agency_id}/docs/...; storage policies check that prefix.
- Every query in the app is scoped to the active agency. A user can belong to several agencies; the active one is chosen at login and switchable.
- Platform super admins (Parcolia staff) are in a separate platform_admins table and use a separate /platform area.

## Roles inside an agency
Only two roles: 'admin' and 'staff'. There is no separate "owner" role.
- admin: the agency owner(s). Everything, including billing, deleting the agency, adding admins and staff, seeing money. An agency can have several admins, all with the same powers. The person who creates the agency becomes its first admin. The last active admin can never be removed, disabled or demoted.
- staff: daily work (reservations, contracts, fleet status, maintenance, vidange, assurance, assistant). Cannot add users, cannot see statistics, charges or revenue.
Enforce roles in RLS AND hide forbidden UI. Never rely on UI hiding alone.

## Branding
- Agency branding: name, logo, brand color, address, phone, email, RC, ICE, IF, patente, CNSS, contract terms. Shown in the app header, on contracts and PDFs.
- Parcolia branding: login, signup, marketing pages, emails, and a small "Propulsé par Parcolia" line in the sidebar footer and the PDF footer.
- The agency brand color drives the --brand CSS variable; check contrast and fall back to a dark navy if it is too light.

## Design rules
- Mobile-first and fully responsive: phone 360–480px, tablet 768–1024px, laptop 1280px+. NO horizontal page scroll at any size.
- Phone: bottom navigation (5 main items + "Plus"), sticky header, full-width forms, tables become cards.
- Tablet: collapsible icon rail sidebar. Laptop: fixed sidebar + fixed header.
- Header: agency logo and name, the user's name with the role in small text under it.
- Touch targets at least 44px. Inputs at least 16px font on mobile (no iOS zoom).
- Yes/No questions use two big buttons (Oui / Non), never small checkboxes.
- Lists are grouped by urgency, most urgent first (late, today, tomorrow, after tomorrow, later).
- Every action button has a small icon plus a short label.
- Use logical CSS properties (ms-, me-, ps-, pe-, start, end) so Arabic RTL works without special cases.
- Wrap amounts, dates, times, phones, plates, IDs and emails in <Ltr> (components/app/ltr.tsx) so they keep their order in Arabic.
- Light and dark themes, both polished. The header has a language button (round flag opening Français / English / العربية with flags) and a one-tap light/dark button (moon/sun) next to the user's name; both are saved in the profile.
- Empty states explain what to do next. Errors say how to fix them. Toasts confirm every save.
- Accessibility: labels on every input, visible focus, AA contrast, aria on icon-only buttons.

## Domain words (keep these French terms in the UI and code comments)
Parc auto (fleet), Réservation, Contrat, Livraison (delivery inside a reservation), Caution, Avance, Franchise, Vidange (oil change), Assurance, Visite technique, Charges (expenses), Matricule (plate), CIN, Permis.
Money is MAD, formatted "1 250 MAD". Dates dd/mm/yyyy. Week starts Monday. Time zone Africa/Casablanca.

## Code conventions
- Feature folders: app/[locale]/(app)/{feature}, with components, actions.ts, queries.ts, schema.ts per feature.
- Server actions validate with zod, check the role, then call Supabase. Return typed results { ok, error }.
- Generate DB types with `supabase gen types typescript` after every migration.
- No `any`. No secrets in the repo; use .env.local and document every variable in .env.example.
- Every new table: migration + RLS policies + types + seed data for the demo agency.
- After each task: run lint, type-check and tests, and fix everything before saying it is done.
