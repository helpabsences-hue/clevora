# Usability (UX)

Parcolia is used by people who are not technical, often on a phone in the parking lot. Every daily task must be quick, with big buttons and plain words.

## Taps for the daily tasks (phone)

Typing (a number, a name) is not counted; picking a date or a choice is.

| Task | From | Taps | Notes |
|---|---|---|---|
| Record a return | Aujourd'hui › "Retour" on the row | 3 + km | Retour › fuel level › Enregistrer. Late days and the amount due are computed. |
| Call a client | Aujourd'hui | 1 | Phone button on each return / departure. |
| New reservation (known client) | "+" in the bottom bar | about 10 + typing | Dates, car, CIN (the client fills in by itself), Suivant ×3, fuel, Enregistrer. The draft is kept if the phone loses the connection. |
| Start a rental (contract signed) | Contrats › "Démarrer" | 3 + km | |
| Oil change done | Vidange › "Vidange faite" | 3 + km | "Same interval as last time" fills the next km in one tap. |
| Who had the car (fine, radar) | Réservations › "Infraction" | 2 + plate and date | Driver, phone and ID shown at once. |
| Car to the garage | Parc auto › ⋯ › Maintenance | 4 | Reason, expected return, confirm. |
| Light / dark | Header (sun / moon) | 2 | |

## Rules we check

- Phone 360–480 px, tablet 768–1024 px, laptop 1280 px+; never a sideways page scroll.
- Touch targets ≥ 44 px; inputs ≥ 16 px (no zoom on iPhone).
- Every action button has an icon and a short label; icon-only buttons have a spoken label.
- Lists most urgent first; empty states say what to do next; every save shows a toast.
- French, Arabic (right to left) and English; numbers, dates, plates and phones keep their order in Arabic.
- Times are always computed on the server (Africa/Casablanca): phones can have outdated time-zone data.

## Automated checks (run on every change)

| Check | Where |
|---|---|
| Accessibility WCAG 2.1 AA (axe), page errors, missing texts, sideways scroll, on every page at 3 sizes | `e2e/quality.spec.ts` |
| Installable app, offline page | `e2e/pwa.spec.ts` |
| Reservation draft | `e2e/draft.spec.ts` |
| Same texts in fr / ar / en; client text groups | `npm run i18n:check` |

Lighthouse (mobile, slow 4G simulation), November 2026: accessibility 100, best practices 100, SEO 100, performance 80–83 on the main logged-in pages.

## Installable app

`/manifest.webmanifest`, icons in `public/icons/`, service worker `public/sw.js`.
The service worker caches only the app's own files (code, icons). Pages and data are never cached, because they hold the agency's private data: offline, a simple page explains that the connection is missing.
