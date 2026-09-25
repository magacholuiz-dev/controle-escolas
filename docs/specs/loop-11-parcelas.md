# Loop 11 — Installment purchases

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 11 · **Size:** S · **Depends on:** Loop 1
**Files:** `installments.js` (pure), `db.js` (Bill fields), `server.js`, `public/app.js`

## Goal
A purchase can be entered in installments: "R$ 2.000 in 3x" (total) or "10x of R$ 340" (value of each installment). Each installment becomes a bill (Loop 1), one per month, payable on its own.

## Decisions
| Decision | Choice | Why |
|---|---|---|
| Where installments live | As **bills** (contas a pagar), not recurring expenses or entries | They already have due date, status, payment and undo; an installment is exactly "a bill due later" |
| Two input modes | Exactly one of `total_amount` / `installment_amount`, plus `count` | Matches how the owner thinks ("3x of..." vs. "total of...") |
| Rounding | Integer cents; leftover cents go one each to the first installments | 2000 in 3x = 666,67 + 666,67 + 666,66 — always sums to the total |
| Due dates | Same day of the month as the 1st, clamped to short months (31st → Feb 28, then back to 31st) | No drift |
| Limits | 1–60 installments | Sanity cap |
| Grouping | New `installment_group_id` (separate from `group_id`, which is the school split) | A purchase can be split *and* installment later without the two colliding |
| Removing | `DELETE /bills/:id?installments=1` removes only the **unpaid** installments | Paid ones already have an entry in the ledger |

## Acceptance criteria
- [x] AC1 — 2000 in 3x creates 3 monthly bills (666,67 / 666,67 / 666,66) summing to exactly 2000 *(test `AC1`, `test-installments.js`)*
- [x] AC2 — 10x of 340 creates 10 bills of 340 (total 3400) *(test `AC2`)*
- [x] AC3 — Paying one installment pays only it and creates one entry *(test `AC3`)*
- [x] AC4 — Removing the purchase deletes only unpaid installments *(test `AC4`, mutation-checked)*
- [x] AC5 — Logged in the audit log (who, what, how many, total) *(test `AC5`)*
- [x] AC6 — Invalid input (both/neither value, 0 or 61 installments, negative, impossible date, blank description, unknown supplier) returns 400 and creates nothing; a director can't buy for the other school *(test `AC6`)*

## Verification
Suites: logic 15/15, API 70/70. Browser: filled the form for 2000 in 3x (preview "3x de R$ 666,67 (as últimas R$ 666,66) = total de R$ 2.000,00"), got 1/3, 2/3, 3/3 on 25/09, 25/10, 25/11; 10x of 340 created 10 rows; no console errors; no horizontal overflow at 375px. Mutation checks: cent distribution, day clamping, and the unpaid-only delete filter all make a test fail.

## Result
Shipped a "Compra parcelada" card on the Bills tab, a "Parcela" column (`2/3`) and an "Excluir compra" action.

Carry-overs:
- Installments are bills, so they show up in cash flow **when paid** (like every bill) — the Dashboard's forward cash projection doesn't count future unpaid installments yet.
- No splitting an installment purchase between the two schools in one step (split a bill afterwards, or enter it per school).
- Editing one installment's amount doesn't rebalance the others.
