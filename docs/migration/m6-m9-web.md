# M6–M9 — Next.js front, e2e, hardening

## Delivered
- `apps/web`: Next 15 (App Router, React 19, Tailwind 4, zustand, recharts). 16 routes under `(app)/`, `login`, middleware redirecting to `/login` without the `sid` cookie. Same look as the legacy UI (`globals.css` = legacy `style.css` ported 1:1).
- Same-origin rule: the browser only talks to the Next origin; `next.config.ts` rewrites `/api/*` to `API_URL`. **Rewrites are evaluated at build time, so `API_URL` must be set when running `next build` (also on Vercel).**
- `apps/web/e2e` (Playwright, 13 tests): login/session/logout, all 16 screens without console errors, CRUD + dialogs, severance, installments (incl. consecutive-prompt regression), split, dashboard == API, scenarios, OFX reconciliation, calendar/settings persistence, users + director scoping, mobile overflow, light/dark.
- `apps/api/test/routes.test.mjs`: enumerates every registered Nest route; all must answer 401 with no session (except login/logout/me), owner-only routes 403 for a director, other school 403. Runs under `node:test` because Jest's VM sandbox breaks the MongoDB driver client metadata. Mutation-checked (making a controller `@Public()` fails it).

## Bugs found by the safety net
- Modal instances reused between consecutive prompts (date prompt inherited the amount) → `key={pending.id}`; regression assertion in e2e.
- Chart axis domain semantics differed from legacy → fixed and unit-tested.

## Status
All suites green: domain (golden, 57), api (Jest 10 + routes 3), web (6), contract on Nest (72 incl. index + parallel-run parity), e2e 13.
Next: M10 cutover (see MIGRATION_PLAN.md).
