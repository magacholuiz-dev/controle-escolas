# Roadmap

Every loop follows the [process](./LOOP_PROCESS.md) and has a spec in [`specs/`](./specs/). Loops 0
through 10 are all **Done**.

## Loops

| # | Loop | Size | Depends on | What it delivers | From the benchmark | Status |
|---|---|---|---|---|---|---|
| 0 | [Verified baseline and local hardening](./specs/loop-00-baseline.md) | S | n/a | Everything that exists, proved against a real Mongo, API tests, app and Mongo only on `127.0.0.1`, backup | n/a (tech debt) | **Done** |
| 1 | [Bills to pay](./specs/loop-01-contas-a-pagar.md) | M | 0 | Due date, payment, suppliers, due-bills card | Nibo, Proesc | **Done** |
| 2 | [Children, classrooms and derived revenue](./specs/loop-02-criancas-e-receita.md) | L | 0 | City-hall revenue coming from enrollment and school days | Sponte, Gennera | **Done** |
| 3 | [Tuition and delinquency](./specs/loop-03-mensalidades-inadimplencia.md) | M | 2 | Tuition, payment, lateness brackets, debtors | Sponte, Gennera | **Done** |
| 4 | [Chart of accounts, cost centers and income statement](./specs/loop-04-dre-centros-de-custo.md) | M | 1 | Income statement per school and consolidated, budgeted vs. actual | Nibo, Sponte | **Done** |
| 5 | [Metrics and comparison](./specs/loop-05-indicadores.md) | S | 2, 3, 4 | Cost per child, break-even point, Novo Mundo vs. CIC | Gennera | **Done** |
| 6 | [Scenarios](./specs/loop-06-cenarios.md) | M | 0 | "What if the city hall is late?", hiring/firing, cutting an expense | ours (see BENCHMARK §priority 4) | **Done** |
| 7 | [Alerts and severance reserve](./specs/loop-07-alertas-e-reserva.md) | M | 1, 3 | Alert center, monthly severance provision | ours | **Done** |
| 8 | [Users, permissions and audit log](./specs/loop-08-usuarios-permissoes.md) | L | 0 | Login, roles per school, audit log | the market in general | **Done** |
| 9 | [Export for the accountant and attachments](./specs/loop-09-exportacao-e-anexos.md) | M | 1, 4 | CSV export (payroll, DRE, paid bills, entries) | Nibo, Unimestre | **Done** |
| 10 | [Bank reconciliation (OFX)](./specs/loop-10-conciliacao-bancaria.md) | M | 1, 3 | Import a statement, suggest and confirm payments | Nibo, Proesc | **Done** |

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
| 3 | ~~Will the app run only on this computer, or in the cloud? Who will use it: just you, the school directors, the accountant?~~ — **Answered 2026-09-24**: cloud (a Droplet + Vercel; infra choice not yet finalized), users are the owner (both schools) and one director per school; the accountant is not using it yet | Loop 8 — resolved, spec now `Ready` |
| 4 | ~~Yearly staff turnover (an approximate number is fine)~~ — resolved, used as the editable `turnover_pct` field per school (Loop 7) | Loop 7 — resolved |
| 5 | Which bank do the schools use? Is private tuition charged by bank slip, Pix, or cash? | Loop 10 accepts OFX from any bank, so this only still blocks the parked bank-billing item (boleto/Pix charging) |

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
| 16 | Category-to-group map for the income statement is a single global constant, not editable per school | Loop 9 (or sooner if it becomes annoying) |
| 17 | Income statement is annual only, no 12-column monthly breakdown | Would need `calc.js` to keep a per-month category breakdown; no clear demand yet |
| 18 | `bills.test.js` AC6 had a date hard-coded to when it was written (`2026-09-22`) and failed the next day | Fixed in Loop 4 by using a relative "yesterday"; a reminder to avoid hard-coded "today" dates in tests going forward |
| 19 | The top "All schools" filter was silently swapped for the first school on **every** tab except Dashboard — DRE's consolidated view (Loop 4) was never actually reachable by clicking, only by a direct request | Fixed in Loop 5: `dashboard`, `statement` and `metrics` now allow "All" |
| 20 | Break-even uses the blended (public+private) average revenue and variable cost per child, not the marginal rate of an additional public-funded child | Revisit if the owner wants the marginal-rate version instead |
| 21 | Scenarios can't simulate a salary raise or a change in enrollment (needs `calc.js` to support a salary/revenue that varies by month) | Later, if there's demand |
| 22 | Reopening a saved scenario doesn't reload its adjustments into the builder for editing | As preferred |
| 23 | Overdue bills and high delinquency aren't surfaced as Dashboard *alerts* (they already have their own panels since Loops 1/3) | Only if the owner wants them duplicated into the alert center too |
| 24 | No XLSX (binary), no severance PDF, no file attachments — CSV export only | A future loop, if the owner needs them; XLSX/PDF need a way to actually verify the output, and attachments need real file upload testing |
| 25 | OFX parser tested only against a hand-built file (public spec), never a real bank export | Validate against a real statement once one is available (question 5 above) |
| 26 | The reconciliation tab shows each transaction but not a "does the ledger balance match the app's balance" summary, even though `ledgerBalance`/`ledgerDate` are already parsed and returned by the import endpoint | A future loop, if useful |
| 27 | Confirming a bank-transaction suggestion always pays with the transaction's own date and amount; changing either requires "lançar manualmente" instead | As preferred |
| 28 | No `accountant` (read-only) role, and no masking of salary/CPF for a role without permission to see them | Add both together when someone besides the owner/directors needs access (e.g. the accountant) |
| 29 | No password recovery by e-mail; only the owner can reset anyone's password from the Users tab | As preferred, or if a director locks herself out and the owner is unreachable |
| 30 | No two-factor authentication | A future loop, especially once the app is actually reachable from the internet |
| 31 | Deploy infrastructure itself (which service runs what on the Droplet/Vercel split, TLS, production `SEED_OWNER_PASSWORD`) is still a manual step outside the app's Loop Engineering | Do this before real directors log in over the internet |
| 32 | A director's "all schools" view was only tested with one school per director (the real case today); the code sums correctly for `school_ids` with more than one, but that path has no test | Add a test if a director ever manages two schools |

## Changelog

| Date | Change |
|---|---|
| 2026-09-21 | **Loop 0 Done**: real Mongo verified, 5 API tests, input validation, server and Mongo restricted to 127.0.0.1, backup/restore. Added AC10 (Mongo exposed to the network, found during VERIFY) |
| 2026-09-23 | **Loop 9 Done**: CSV export (payroll, DRE, paid bills, entries) for the accountant, Brazilian-Excel formatted (`;`, `,` decimal, BOM). XLSX, the severance PDF and file attachments cut from scope — see the spec's Result |
| 2026-09-23 | **Loop 10 Done**: OFX statement import, fingerprint-based dedup, automatic bill/tuition suggestion (±3 days, exact amount, debit-only-matches-bill / credit-only-matches-tuition), human-confirmed payment reusing `payBill`/`payTuition`, manual entry for unmatched transactions, "Conciliação bancária" tab. No new dependency. Open item: no real bank OFX file was available to test against — see carry-over #25 |
| 2026-09-24 | Owner answered open question 3: the app is going to the cloud (Droplet + Vercel, infra TBD), users are the owner and one director per school (no accountant login yet). **Loop 8 spec moved Draft → Ready**, scoped to `owner`/`director` roles only (accountant role cut, kept easy to add later) |
| 2026-09-24 | **Loop 8 Done**: login (cookie session, scrypt hash), `owner`/`director` roles with school-level scoping applied at every route that carries a school id, user management restricted to the owner, an audit log for salary/severance/user changes, 6-attempt login lockout, and a login page with redirect-when-unauthenticated. Sensitive-field masking and the `accountant` role cut from scope (no role needs them yet) — see carry-over #28 |
| 2026-09-23 | **Loop 7 Done**: alert center (vacation deadline, a bill above its average, negative cash coming up) on the Dashboard; monthly severance reserve (`turnover_pct`, 0% by default, never touches cash) |
| 2026-09-23 | **Loop 6 Done**: scenario simulator (delay the city-hall transfer, hire, fire with a real severance cost, cut an expense category) compared against the base, without touching any real data; save/reopen/delete scenarios |
| 2026-09-23 | **Loop 5 Done**: cost/revenue per child, payroll over revenue, break-even point, Novo Mundo vs. CIC comparison with a per-row winner, monthly margin; fixed a navigation bug that blocked the "All schools" view outside the Dashboard (also affected Loop 4's DRE) |
| 2026-09-23 | **Loop 4 Done**: income statement (DRE) with a fixed category→group map, matching the Dashboard's profit to the cent for a school and consolidated; fixed a date-hard-coded flaky test from Loop 1 |
| 2026-09-22 | **Loop 3 Done**: tuition per privately-funded child, payment with a payment method, lateness brackets, delinquency and a copyable billing message (no CPF) on the Dashboard |
| 2026-09-22 | **Loop 2 Done**: revenue derived from enrollment (children × school days × rate per child-day), with the manual revenue "superseded" and a documented scope cut (no dated Contract record); Children tab, occupancy on the Dashboard; fixed a database-name collision in the API tests |
| 2026-09-22 | **Loop 1 Done**: bills to pay (due date, payment, suppliers, splitting), due-bills card on the Dashboard; fixed a Loop 0 carry-over (nonexistent id → 404 on every resource) |
| 2026-09-21 | Roadmap created from the benchmark (`BENCHMARK.md`): 11 loops (0 to 10) in Draft |
