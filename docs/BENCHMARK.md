# Benchmark: financial management for schools

Sources consulted in Sep/2026: product pages and blog posts from Nibo, Proesc, Unimestre, Delta SGE,
Sponte and Gennera, plus severance calculators (InfinitePay, Legale, Guia CLT). None of these systems
was tested hands-on; what follows comes from what they publish.

## What the market offers

| Feature | Who publishes it | In this app |
|---|---|---|
| Bills to pay by expense type with **cost-center splitting** | Nibo, Proesc, Edukante | **Done** (due date, payment, suppliers; split between schools: even, by children, manual — Loop 1) |
| Reports by chart of accounts and cost center, income statement per unit | Sponte, Gennera, Nibo | **Done** (annual income statement per school and consolidated, matching the Dashboard's profit to the cent — Loop 4) |
| Cash flow with forecast | Sponte, Gennera | Done (accrual and cash, with months with no transfer) |
| Budgeted vs. actual | Nibo, Unimestre | Done (per category) |
| Automatic billing, bank slips (boleto), bank file exchange | All of them | No |
| Per-student delinquency tracking | Sponte (claims 30%+ reduction), Gennera | **Done** (tuition, lateness brackets, delinquency %, billing message — Loop 3) |
| Enrollment, delinquency and retention metrics | Gennera | Partial: enrollment/occupancy (Loop 2), cost/revenue per child and break-even (Loop 5) **done**; retention not done |

## Severance (Brazilian CLT labor law)

Rules used in `severance.js`, checked against the calculators above and against Law 12.506/2011:

- Without cause: salary balance, notice (30 days + 3 per year, capped at 90), proportional 13th
  salary and vacation + 1/3, vested vacation + 1/3, 40% FGTS fine, 100% withdrawal.
- Mutual agreement (art. 484-A): half the notice, 20% fine, 80% withdrawal.
- Resignation: no pay-in-lieu notice (discount if not worked), no fine, no withdrawal.
- For cause: only the salary balance and vested vacation.

Limits: gross amounts (no INSS/IRRF withholding), no overtime/variable averages, FGTS balance
estimated when not given. Always confirm with the accountant before paying.

## What's still worth adding (by priority)

1. ~~Bills to pay with due date and payment~~ — done in Loop 1.
2. ~~Tuition per child and delinquency~~ — done in Loops 2 and 3.
3. ~~Metrics: cost per child, payroll over revenue, break-even point, Novo Mundo vs. CIC comparison~~
   — done in Loop 5.
4. ~~Scenarios: "what if the city hall is late?", hiring/firing, cutting an expense~~ — done in Loop 6
   (enrollment/salary scenarios still not supported, see the roadmap carry-overs).
5. **Alerts**: vacation coming due (risk of double pay), an electricity bill above average, negative
   cash flow ahead.
6. ~~Severance reserve: provision a share of the FGTS fine and notice every month~~ — done in Loop 7,
   together with an alert center (vacation deadline, a bill above average, negative cash coming up).
   Our own suggestion, not seen in the competitors.
7. ~~Export for the accountant~~ — done in Loop 9, as CSV (not XLSX/PDF; see carry-overs).
   Attaching receipts and invoices is still not done.
8. ~~Users and permissions~~ — done in Loop 8: login, an owner role (both schools) and a director
   role (scoped to one school), an audit log. A read-only accountant role and sensitive-field
   masking are cut for now — see the roadmap carry-overs.
9. ~~Bank reconciliation (importing an OFX statement)~~ — done in Loop 10 (OFX only; tested against a
   hand-built file, not a real bank export — see the roadmap carry-overs).
