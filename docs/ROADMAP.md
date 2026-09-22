# Roadmap

Every loop follows the [process](./LOOP_PROCESS.md) and has a spec in [`specs/`](./specs/). Loops 0
through 3 are **Done**; the rest are in **Draft**: the PLAN exists, and REFINEMENT happens once the
loop becomes the next one up (so it isn't refined against code that's still going to change).

## Loops

| # | Loop | Size | Depends on | What it delivers | From the benchmark | Status |
|---|---|---|---|---|---|---|
| 0 | [Verified baseline and local hardening](./specs/loop-00-baseline.md) | S | n/a | Everything that exists, proved against a real Mongo, API tests, app and Mongo only on `127.0.0.1`, backup | n/a (tech debt) | **Done** |
| 1 | [Bills to pay](./specs/loop-01-contas-a-pagar.md) | M | 0 | Due date, payment, suppliers, due-bills card | Nibo, Proesc | **Done** |
| 2 | [Children, classrooms and derived revenue](./specs/loop-02-criancas-e-receita.md) | L | 0 | City-hall revenue coming from enrollment and school days | Sponte, Gennera | **Done** |
| 3 | [Tuition and delinquency](./specs/loop-03-mensalidades-inadimplencia.md) | M | 2 | Tuition, payment, lateness brackets, debtors | Sponte, Gennera | **Done** |
| 4 | [Chart of accounts, cost centers and income statement](./specs/loop-04-dre-centros-de-custo.md) | M | 1 | Income statement per school and consolidated, budgeted vs. actual | Nibo, Sponte | Draft |
| 5 | [Metrics and comparison](./specs/loop-05-indicadores.md) | S | 2, 3, 4 | Cost per child, break-even point, Novo Mundo vs. CIC | Gennera | Draft |
| 6 | [Scenarios](./specs/loop-06-cenarios.md) | M | 0 | "What if the city hall is late?", losing children, a raise | ours (see BENCHMARK §priority 4) | Draft |
| 7 | [Alerts and severance reserve](./specs/loop-07-alertas-e-reserva.md) | M | 1, 3 | Alert center, monthly severance provision | ours | Draft |
| 8 | [Users, permissions and audit log](./specs/loop-08-usuarios-permissoes.md) | L | 0 | Login, roles per school, masked sensitive fields, audit log | the market in general | Draft |
| 9 | [Export for the accountant and attachments](./specs/loop-09-exportacao-e-anexos.md) | M | 1, 4 | XLSX/CSV/PDF, receipt and invoice attachments | Nibo, Unimestre | Draft |
| 10 | [Bank reconciliation (OFX)](./specs/loop-10-conciliacao-bancaria.md) | M | 1, 3 | Import a statement, suggest and confirm payments | Nibo, Proesc | Draft |

Sizes: **S** ≈ 1–2 days · **M** ≈ 3–5 days · **L** ≈ 1–2 weeks (one person, with tests and VERIFY).

## Recommended order and why

```
0 ──► 1 ──► 4 ──┐
│                ├──► 5 ──► 7 ──► 9 ──► 10
└──► 2 ──► 3 ───┘
│
├──► 6      (can slot in anywhere after 0)
└──► 8      (moves up in priority if the app goes to the cloud)
```

1. **Loop 0 first:** the existing code had never run together with a real Mongo. Stacking features
   on top of that would just be debt.
2. **Bills to pay (1) before children (2):** delivers value right away (nothing is due without a
   warning) and it's the part that already suffers in the months with no transfer.
3. **Children (2) depends on an answer from the owner** about how the city hall calculates the
   transfer. Ask now, while Loops 0 and 1 are underway.
4. **Loop 8 is a gate, not a feature:** the app stores salary, CPF and severance data. As long as it
   runs only on the local machine, it can wait. The day it goes to the cloud or is opened to someone
   else, it jumps ahead of everything.

## Parked (no loop until there's a decision)

| Item | Why it's waiting |
|---|---|
| Bank billing: bank slips (boleto), Pix charges, CNAB file exchange | Depends on which bank or PSP the schools use and the cost per bank slip |
| Sending charges and alerts by WhatsApp/email | Depends on the provider and on guardians' consent (LGPD) |
| Two-factor authentication | Comes after Loop 8 |
| Official eSocial/TRCT filing | That's the accountant's job; the app only simulates it |

## Open decisions for the owner

Without these, the marked loops never reach `Ready`:

| # | Question | Blocks |
|---|---|---|
| 1 | How does the Curitiba city hall calculate the transfer: rate per child per school day, a flat monthly rate per slot, or something else? Is there a cap on slots? (the contract's text settles it) | Loop 2 (and 5) |
| 2 | A child entering/leaving mid-month: is the transfer proportional to the days? | Loop 2 |
| 3 | Will the app run only on this computer, or in the cloud? Who will use it: just you, the school directors, the accountant? | Loop 8 (and the order of everything) |
| 4 | Yearly staff turnover (an approximate number is fine) | Loop 7 |
| 5 | Which bank do the schools use? Is private tuition charged by bank slip, Pix, or cash? | Loops 3 and 10, and the parked billing item |

## Global Definition of Done

- Spec `Done` with a Result, a Verification record and a retro.
- `npm test` and `npm run test:api` green, with the counts recorded in the spec.
- A browser walkthrough done in light theme, dark theme and phone width.
- At least one number on screen checked by hand against a calculation done outside the app.
- `README.md` and `BENCHMARK.md` (the "In this app" column) updated.

## Carry-overs

From Loop 0 (details in its spec):

| # | Carry-over | Goes into |
|---|---|---|
| 1 | `PUT`/`DELETE` with a nonexistent id returned 200 instead of 404 | Loop 1 |
| 2 | Errors surfaced via `alert()`; switch to an on-page notice | Loop 1 (together with the bills screen) |
| 3 | The Dashboard's school filter gets tangled with the records' filter | Loop 5 |
| 4 | **Kivoni's** Mongo (port 27018) exposed to the local network | Outside this project: tell the owner |
| 5 | No CSP/HTTPS | Loop 8 |
| 6 | The `launch.json` entry lives outside this repository | Once there's a repository of its own |
| 7 | Paying a bill uses the browser's `prompt()` | Once the app has a modal pattern |
| 8 | Splitting a bill requires typing the due date by hand | Loop 5 (UX polish) or as preferred |
| 9 | No editing a supplier from within the Bills screen | As preferred |
| 10 | Test database name could collide between files (`pid+Date.now()`) | Fixed in Loop 2 (random bytes); revisit if it flickers again |
| 11 | The school-days proration formula hasn't been checked against a real city-hall invoice | Loop 5, or sooner if an invoice turns up |
| 12 | Loop 1's splitting uses `school.children_count` (manual), not the real `Child` collection | Decide whether to migrate it or document them as independent sources |
| 13 | No history of `child_daily_rate` changes mid-year | If it's ever needed |
| 14 | No automatic interest/fine on a late tuition charge (use a negative `discount` as a manual surcharge if needed) | Settle the legal rule with the owner before automating it |
| 15 | Manually creating a tuition charge (outside "generate") doesn't check that the child belongs to the given `school_id` | Harden it if a real case shows up |

## Changelog

| Date | Change |
|---|---|
| 2026-09-21 | **Loop 0 Done**: real Mongo verified, 5 API tests, input validation, server and Mongo restricted to 127.0.0.1, backup/restore. Added AC10 (Mongo exposed to the network, found during VERIFY) |
| 2026-09-22 | **Loop 3 Done**: tuition per privately-funded child, payment with a payment method, lateness brackets, delinquency and a copyable billing message (no CPF) on the Dashboard |
| 2026-09-22 | **Loop 2 Done**: revenue derived from enrollment (children × school days × rate per child-day), with the manual revenue "superseded" and a documented scope cut (no dated Contract record); Children tab, occupancy on the Dashboard; fixed a database-name collision in the API tests |
| 2026-09-22 | **Loop 1 Done**: bills to pay (due date, payment, suppliers, splitting), due-bills card on the Dashboard; fixed a Loop 0 carry-over (nonexistent id → 404 on every resource) |
| 2026-09-21 | Roadmap created from the benchmark (`BENCHMARK.md`): 11 loops (0 to 10) in Draft |
