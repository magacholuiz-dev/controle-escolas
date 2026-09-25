# Migration plan — TypeScript, NestJS (API) and Next.js (front)

Status: **Plan (Draft)** · Written 2026-09-25 · Process: [LOOP_PROCESS.md](./LOOP_PROCESS.md) · Product roadmap (Loops 0–11, all Done): [ROADMAP.md](./ROADMAP.md)

This is a second track next to the product roadmap: **no new features, same behavior, new stack.** Loops here are named **M0…M10** so they don't collide with the product loops. Each M-loop gets its own spec in `docs/migration/` when it becomes the next one up (PLAN → REFINEMENT → IMPLEMENT → TEST → VERIFY → DOCUMENT → PLAN AGAIN, exactly as before).

## 1. Why, and what "done" means

- One language end to end, with types on the money math and on the API contract. Two real bugs from this project were "wrong field read, `undefined` shipped" (`summarize()` in Loop 6, `report.result` vs `report.totals.result`); strict types make that class of bug a compile error.
- Same stack and conventions as Kivoni (Nest 11 + Mongoose 9, Next 15 + React 19 + Tailwind 4 + zustand, Jest/Vitest/Playwright), so the two products are maintained the same way.
- Replace the 1,089-line single-file front (`public/app.js`) and 876-line hand-rolled router (`server.js`) with modules that can be tested and changed in isolation.

**Done means:** the new stack is in production, the old one is switched off, and the numbers are identical — proven by tests, not by eye (section 4).

**Not a goal:** new features, a redesign, a data migration, a new database, changing the Portuguese UI text. Anything tempting goes to the carry-over list at the bottom.

## 2. Current system (what has to be reproduced)

| Area | Today | Size |
|---|---|---|
| Pure domain modules | `calc`, `severance`, `proration`, `bills`, `children`, `tuition`, `statement`, `metrics`, `scenarios`, `alerts`, `export`, `ofx`, `reconciliation`, `installments`, `auth` (hash/lock helpers), `errors` | ~1,000 lines, 15 test files (`test-*.js`) |
| HTTP API | `server.js` on `node:http`: 10 generic CRUD resources + custom routes below | 876 lines |
| Data | Mongoose 9, 14 models in `db.js`, Mongo 7 | 213 lines |
| Front | Vanilla ES module SPA, 16 tabs, inline SVG charts, `alert/prompt/confirm` for dialogs | 1,089 + html/css |
| Tests | 15 pure-logic files + 13 HTTP suites (70 tests) booting the API in-process against a disposable Mongo | — |
| Deploy | Front on Vercel (static, `/api/*` proxied to the droplet), API + Mongo on the droplet behind Nginx Proxy Manager, GitHub Actions on push to `main` | live |

**HTTP surface to preserve** (paths, methods, status codes, JSON shapes, Portuguese error messages):

- `auth`: login, logout, me · `users` CRUD (owner) · `audit` (owner)
- Generic CRUD: `employees`, `revenues`, `expenses`, `entries`, `schools`, `children`, `tuition`, `suppliers`, `scenarios`, `bills`
- Bills: `generate`, `installments`, `panel`, `:id/pay`, `:id/undo`, `DELETE ?group=1` / `?installments=1`
- Tuition: `generate`, `panel`, `:id/pay`, `:id/undo` · `children/occupancy`
- Reports: `report`, `statement`, `metrics`, `alerts`, `scenarios/simulate`, `calendar` (GET/PUT), `severance` (GET/POST), `split`
- `export/{payroll,statement,bills,entries}` (CSV, `;` separator, `,` decimal, BOM)
- `bank/{import,list,:id/confirm,:id/manual}`
- Cross-cutting: session cookie (`sid`, httpOnly), school scoping (owner vs director), audit log on every write, 1 MB body limit, login lockout (6 tries / 15 min), CORS for `*.vercel.app`, `400` never `500` on bad input.

## 3. Target architecture

```
controle-escolas/
├─ apps/
│  ├─ api/        NestJS 11 + @nestjs/mongoose + class-validator   (→ droplet, Docker)
│  └─ web/        Next.js 15 (App Router) + React 19 + Tailwind 4   (→ Vercel)
├─ packages/
│  ├─ domain/     pure TypeScript: calc, severance, … (no Nest, no Mongoose, no React)
│  └─ contracts/  request/response types + zod (or DTO-derived) schemas shared by api and web
├─ legacy/        today's JS app, untouched until cutover, then deleted
└─ docs/
```

- **API modules** (one Nest module each, thin controllers, logic in services that call `packages/domain`): `auth`, `users`, `audit`, `schools`, `employees`, `revenues`, `expenses`, `entries`, `suppliers`, `children`, `tuition`, `bills`, `scenarios`, `reports` (report/statement/metrics/alerts/calendar/occupancy), `severance`, `bank`, `export`.
- **Cross-cutting in Nest, once:** `SessionGuard` + `@Roles()`, `@SchoolScope()` (one place decides which schools a request may touch — replaces the ~25 hand-placed `checkAllowed` calls), `AuditInterceptor` + `@Audited()` (replaces the per-route `audit()` calls), a global exception filter that keeps today's status codes and Portuguese messages, `ValidationPipe`, 1 MB body limit, helmet, throttler on login.
- **Web:** App Router, one route per current tab (`/painel`, `/receitas`, `/criancas`, …), a typed API client generated from `packages/contracts`, zustand only for session/school/year, a reusable editable-table component (replaces the `crud()` helper), a dialog/toast layer that replaces `alert/prompt/confirm`.
- **Same-origin rule (hard-won lesson, see memory `feedback-cross-origin-cookie-deploy`):** the browser only ever talks to the Next origin. `next.config.ts` `rewrites()` proxies `/api/*` to the API. No CORS-with-cookies, ever.
- **Database:** same Mongo, same collections, same field names (already English). Nest schemas declare explicit `collection` names and the same indexes so **no data migration** is needed and rollback is just switching the proxy back.

## 4. Safety net (the part that makes this low-risk)

1. **HTTP contract tests, reused as-is.** The 70 API tests already exercise the API only through HTTP. M0 makes `test/api/helpers.js` accept `API_URL`: unset → boots the legacy app in-process (today); set → talks to any running server. The *same test files* then run against Nest. A route is "migrated" when its tests are green against Nest. Nothing is rewritten, so nothing can be quietly weakened.
2. **Golden numbers for the money math.** A script runs the legacy `calc`/`statement`/`metrics`/`severance`/`scenarios`/`alerts` on the demo dataset and on a set of edge fixtures (leap year, closed months, delayed transfer, mid-month exit…) and stores the JSON. The TS port must reproduce it exactly (`deepStrictEqual`, cents included). This is checked in M1 and again on the running Nest API in M5.
3. **Ported tests keep their assertions 1:1** (`node:test` → Jest/Vitest is a mechanical change). Mutation checks (break it on purpose, confirm a test fails, restore) stay mandatory for each ported module.
4. **Parallel run before cutover.** Old and new API side by side against a copy of the production database; a diff script replays read-only calls (`report`, `statement`, `metrics`, `alerts`, exports) for every school/year and compares responses byte for byte.
5. **Playwright flows** in M9 replay the manual VERIFY checklists that were done for every product loop (login, each tab, create/edit/delete, installments, severance, OFX import, director scoping, mobile 375 px, dark and light).

## 5. Decisions

`Proposal` = my recommendation, confirm at the M-loop's REFINEMENT. `OPEN` = needs the owner before it can be `Ready`.

| # | Decision | Recommendation | Status |
|---|---|---|---|
| D1 | Repo layout | **Monorepo** (npm workspaces) instead of two repos like Kivoni: one PR can change API + web + contract together, one CI, shared types. Kivoni's split exists because it has a mobile app and multiple tenants; this app has neither | OPEN |
| D2 | Big-bang vs incremental | **Incremental with a parallel run**: backend first (proved by contract tests), then the front against it, cutover once at the end. Never a rewrite that only works "at the end" | Proposal |
| D3 | Feature freeze | No product features while M0–M9 run; production bugs are fixed in `legacy/` and ported. Otherwise the target moves | OPEN (owner) |
| D4 | Sessions | Keep the opaque-token session in Mongo (revocable, already tested) as a Nest guard; no Passport/JWT | Proposal |
| D5 | Validation | `class-validator` DTOs (Nest convention, same as Kivoni) with messages in Portuguese; the exception filter maps them to today's `{ error }` shape | Proposal |
| D6 | UI kit | Tailwind 4 + a small headless set (Radix/shadcn-style) for dialog, select, toast; port today's CSS tokens (dark/light) into Tailwind theme variables. No full design system | Proposal |
| D7 | Charts | Recharts, styled with the current categorical palette, following the `dataviz` skill; keep the two Dashboard charts and the per-month table | Proposal |
| D8 | i18n | Single locale (pt-BR) with all strings in one `messages.ts` per app, not `next-intl` — nothing needs a second language today | Proposal |
| D9 | Node/tooling | Node 23, TypeScript `strict: true` (+ `noUncheckedIndexedAccess`), ESLint flat config, Jest for api, Vitest for domain/web, Playwright for e2e — same as Kivoni where it overlaps | Proposal |
| D10 | Hosting | Web on Vercel (Next, `/api` rewrite to the droplet); API + Mongo unchanged on the droplet (new container `controle-escolas-api-ts`, same `web` network, Nginx Proxy Manager forward host switched at cutover) | Proposal |

## 6. Loops

Sizes as in the roadmap: **S** ≈ 1–2 days · **M** ≈ 3–5 days · **L** ≈ 1–2 weeks. Each loop ends with the full old + new suites green, the docs updated, and nothing half-migrated left behind.

| Loop | Delivers | Size | Depends on |
|---|---|---|---|
| **M0** Foundations | Monorepo, TS/lint/CI, Nest skeleton, Mongoose schemas in TS, contract-test harness (`API_URL`), golden-file generator | M | — |
| **M1** Domain core in TypeScript | All 15 pure modules in `packages/domain`, typed, tests ported 1:1, golden numbers identical | L | M0 |
| **M2** API platform | Config, Mongo, sessions/auth/lockout, roles, `@SchoolScope`, audit interceptor, exception filter, CORS, body limit; `auth`/`users`/`audit` routes | M | M0 |
| **M3** CRUD modules | `schools`, `employees`, `revenues`, `expenses`, `entries`, `suppliers`, `children`, `tuition`, `scenarios`, `bills` (+ generate, pay/undo, installments, grouped delete, split) | L | M1, M2 |
| **M4** Reports & analysis | `report`, `statement`, `metrics`, `alerts`, `calendar`, `occupancy`, `scenarios/simulate`, `severance`, `export/*` | M | M1, M3 |
| **M5** Bank reconciliation + parity gate | `bank/*`; then the **backend parity gate**: all 70 contract tests + golden numbers green against Nest | S | M4 |
| **M6** Web foundation | Next app, Tailwind theme, typed client, `/api` rewrite, auth middleware, layout (school/year selectors, tabs as routes), editable-table, dialogs/toasts, formatting helpers | M | M2 |
| **M7** Web screens, batch 1 | Login, Painel (KPIs, alerts, charts, per-month table), Receitas, Despesas, Equipe (+ severance dialog), Crianças, Mensalidades | L | M3, M4, M6 |
| **M8** Web screens, batch 2 | Contas a pagar (+ installments, split), Fornecedores, Calendário, Lançamentos, DRE, Indicadores, Cenários, Conciliação, Usuários + activity log, Parâmetros | L | M5, M7 |
| **M9** End-to-end & parity QA | Playwright flows, parallel-run diff against a production copy, a11y/mobile/dark-light pass, performance budget | M | M8 |
| **M10** Cutover | Deploy, proxy switch, monitoring, 2-week rollback window, then delete `legacy/` | S | M9 |

### Scope and acceptance criteria per loop (the executable summary; full specs at REFINEMENT)

**M0 — Foundations**
- Scope: workspaces, `tsconfig.base` strict, ESLint, `apps/api` (Nest CLI skeleton, `/health`), Mongoose schemas for the 14 models with explicit collection names and identical indexes (unique `fingerprint`; partial unique `expense_id+period`; `child_id+period`; calendar `school_id+year+month`), CI path-filtered per app, `API_URL` mode in the test helper, `scripts/golden.js` producing fixtures from legacy.
- AC1 `npm test` in legacy still 70/70 unchanged. AC2 the 13 HTTP suites can run against `API_URL` (proven by pointing them at legacy over the network). AC3 schemas built from the new code create the same indexes as `db.js` (compare `listIndexes()` per collection). AC4 CI green on an empty PR.

**M1 — Domain core**
- Scope: each module ported with explicit input/output types (`SchoolInputs`, `MonthResult`, `Report`, `Severance…`), `InputError` → a domain error class the Nest filter maps to 400.
- AC1 every ported test passes with identical assertions. AC2 golden fixtures reproduce byte-identical (cents, `null` vs `0`, rounding). AC3 no `any` in `packages/domain`. AC4 mutation check recorded per module. AC5 the package has zero runtime dependencies on Nest/Mongoose.

**M2 — API platform**
- AC1 `auth`, `cors`, and the audit-related tests in `auth.test.js` pass against Nest (login, lockout 423, logout invalidates, director scoping 403, password never in a response). AC2 every non-`auth` route returns 401 without a session (a route-table test enumerates the Nest router, so a new controller can't forget the guard). AC3 body over 1 MB → 413. AC4 the audit interceptor logs create/update/delete with the same `action` names (`employees.create`, `bills.installments`, …) so the existing log screen keeps working.

**M3 — CRUD modules**
- AC1 `api`, `bills`, `children`, `tuition`, `installments`, `scenarios` (CRUD part) suites green against Nest. AC2 field whitelists identical to today's `cols` (mass-assignment test: unknown/extra fields are ignored, not stored). AC3 a nonexistent id → 404, malformed id → 400, never 500, on every resource. AC4 director cannot read/write the other school on any resource (probe generated from the Nest router, one request per route).

**M4 — Reports & analysis**
- AC1 `statement`, `metrics`, `alerts`, `scenarios`, `export` suites green. AC2 golden numbers match through the HTTP layer for the demo dataset, for `all`, each school, and a director. AC3 CSV bytes identical (BOM, `;`, `,`, escaping) — read as raw bytes, not `.text()` (Loop 9 lesson).

**M5 — Bank + parity gate**
- AC1 `reconciliation` suite green (dedup by fingerprint, ±3 days, confirm only pays after a human confirms). **Gate:** 70/70 contract tests + golden numbers green against Nest, and a written diff of any deliberate deviation (expected: none).

**M6 — Web foundation**
- AC1 `/api/*` from the browser reaches the API through the Next rewrite and the session cookie is first-party (checked in a real Safari-like profile, not only headless Chromium). AC2 unauthenticated visit to any page → `/login`. AC3 typed client fails to compile if a contract type changes. AC4 dark/light tokens match today's palette (visual comparison against screenshots of legacy). AC5 no `alert/prompt/confirm` anywhere (carry-overs #2 and #7 get fixed for free).

**M7 / M8 — Screens** (one checklist per tab, all Portuguese text preserved)
- AC per tab: same fields, same computed numbers, same empty/error states, same permissions (director sees only her school; "Usuários" only for the owner), keyboard-usable dialogs, no horizontal page overflow at 375 px, no console errors. Dashboard AC: KPIs and both charts equal the legacy values for the demo data to the cent.

**M9 — E2E & parity QA**
- AC1 Playwright covers the VERIFY checklists of Loops 1–11. AC2 parallel-run diff on a copy of production: 0 differences across every school × year for the read-only endpoints. AC3 Lighthouse/CLS/LCP budget set and met on Painel. AC4 a security pass (`/security-review` over the diff): no route without guard, no secret in the client bundle, cookies `HttpOnly; Secure`.

**M10 — Cutover**
- Steps: backup Mongo → deploy `apps/api` as a new container beside the old → smoke tests through the droplet network → switch the Nginx Proxy Manager forward host → deploy `apps/web` to Vercel (production alias moves last) → watch logs/audit for a day → keep the legacy container stopped-but-present for two weeks → delete `legacy/`.
- AC1 rollback rehearsed once before the real cutover (switch the proxy back, confirm login and a write). AC2 no data written by the new API is unreadable by legacy (schemas are identical), so rollback loses nothing.

## 7. Order, effort, parallelism

Critical path: M0 → M1 → M3 → M4 → M5 (backend parity) → M7 → M8 → M9 → M10. M2 and M6 can overlap with M1/M3 (they need only M0/M2). Rough total for one person, sequentially: **≈ 7–9 weeks** (backend ≈ 3.5–4.5, front ≈ 3, QA + cutover ≈ 1). The backend can be *shipped to production early* behind the old front (the old SPA already calls only `/api/*`), which gives real-traffic validation of Nest before the front rewrite even starts — recommended.

## 8. Risks and how each is contained

| Risk | Contained by |
|---|---|
| Money math drifts by a cent (float vs cents, rounding order) | Golden fixtures + ported tests with identical assertions; cents-based helpers only in `packages/domain` |
| Behavior differs in an edge nobody remembers (error text, status code, order of rows) | The 70 HTTP tests are the spec; parallel-run diff on a production copy |
| Mongo schema/index mismatch corrupts or slows data | M0 AC3 (index comparison), explicit collection names, no data migration at all |
| Cross-site cookie problem returns | Same-origin rewrite is an AC in M6; real-browser check, not only automation |
| Migration never ends / target moves | D3 feature freeze; each M-loop is shippable; backend can go to prod early |
| Access control regressions (LGPD: salaries, CPF, children) | `@SchoolScope`/guard in one place + router-enumerating probe tests (M2, M3) + security review (M9) |
| Vercel/Nest deploy surprises (build memory, env, Node version) | Preview deploy per M-loop from M6; CI builds both apps on every PR |

## 9. Explicitly out of scope (carry-overs, do later)

Real domain instead of `nip.io`; accountant role and sensitive-field masking (product carry-over #28); 2FA; installments in the forward cash projection; XLSX/PDF export; renaming Portuguese UI text; switching database; mobile app.

## 10. What I need from the owner before M0 starts

1. **D1** monorepo (recommended) or two repos like Kivoni?
2. **D3** OK to freeze new features until M9? If not, which features are expected in the meantime (they get built in `legacy/` and ported, which adds ≈ 20–30 % per feature).
3. Is a ≈ 2-month timeline acceptable, and should the backend ship to production early (recommended) or everything at once?
