# Migration M0–M5 — foundations, domain core and the NestJS API

Status: **Done** (2026-09-25) · Plan: [../MIGRATION_PLAN.md](../MIGRATION_PLAN.md)

## What shipped
- **M0 Foundations.** Monorepo (`apps/`, `packages/`, `contract/`, `legacy/`); the legacy app moved to `legacy/` with history; strict `tsconfig.base.json`; the 13 HTTP suites moved to `contract/` and now spawn whatever `API_CMD` says (default: legacy) against a disposable Mongo; `contract/golden/generate.mjs` produces 415 golden cases from the legacy pure modules (60 seeded-random full-year reports included); CI updated.
- **M1 Domain core.** `packages/domain`: all 15 pure modules in strict TypeScript, no `any`, no Nest/Mongoose. Reproduces every golden case exactly; the 16 legacy unit-test files ported 1:1 (57 tests).
- **M2 API platform.** Nest 11: session guard (opaque tokens in Mongo, lockout, cookie flags), `@Scope()` (one place decides school access), exception filter that keeps status codes and Portuguese messages, 1 MB body limit, CORS for `*.vercel.app`, helmet.
- **M3 CRUD modules.** One generic `Resource` (whitelisted fields, scoping, validation hook, audit) behind ten thin controllers; bills (generate, installments, pay/undo, panel), tuition, children (+occupancy), employees (+severance), ledger (+split), scenarios (+simulate).
- **M4 Reports.** report, statement, metrics, alerts, calendar, CSV exports.
- **M5 Bank + parity gate.** OFX import/list/confirm/manual.

## Acceptance
| AC | Evidence |
|---|---|
| Legacy still green | `legacy` 15 pure suites + 70 contract tests |
| Same HTTP suites, other implementation | `npm run test:contract:api` → 70/70 on Nest |
| Same numbers | `packages/domain` golden: 42 tests / 415 cases identical; ported tests 57/57 |
| Same database | `contract/indexes.test.js`: same collections and indexes as legacy |
| Same answers on the same data | `contract/parity.test.js`: identical seed through both servers, ~50 GET endpoints + error paths + CSV bytes + scenario simulation identical |
| Access control not weaker | contract `auth.test.js` (401/403/lockout/scoping) green on Nest; guard and scope mutations make it fail |
| Mutation checks | domain (`calc`, `severance`, `proration`), Nest session guard, Nest school scope, Nest entry ordering (caught by the parity test) |
| Image | `Dockerfile.api` builds; container boots and logs in |

## Deviations from the plan (all deliberate)
- **Audit** is explicit `audit.log()` calls in services, not an interceptor: the action names and before/after payloads had to stay byte-identical with the legacy log, and the payloads are resource-specific.
- **Validation** keeps the legacy hand-written checks and Portuguese messages instead of `class-validator` DTOs: the contract (status + message) is the spec. Body types are TS interfaces.
- `GET /report?school=<valid id with no school>` now answers `404` instead of an empty `200` body.
- `consolidate([])` no longer yields `NaN` (all zeros); not reachable in the app (a director always has a school), removed from the golden set on purpose.
- `calculateSeverance` with a `type` like `"constructor"` is rejected (`Object.hasOwn`); the legacy accepted prototype keys by accident.

## Carry-overs
- Contract suites are still JavaScript (`node:test`); converting them to TypeScript is mechanical and left for after cutover.
- Jest covers only the shared helpers; behavior is covered by the contract suites (by design, so they can never diverge from the spec).
