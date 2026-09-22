# Benchmark: financial management for schools

Sources consulted in Sep/2026: product pages and blog posts from Nibo, Proesc, Unimestre, Delta SGE,
Sponte and Gennera, plus severance calculators (InfinitePay, Legale, Guia CLT). None of these systems
was tested hands-on; what follows comes from what they publish.

## What the market offers

| Feature | Who publishes it | In this app |
|---|---|---|
| Bills to pay by expense type with **cost-center splitting** | Nibo, Proesc, Edukante | **Done** (due date, payment, suppliers; split between schools: even, by children, manual — Loop 1) |
| Reports by chart of accounts and cost center, income statement per unit | Sponte, Gennera, Nibo | Partial (income statement per school and per category) |
| Cash flow with forecast | Sponte, Gennera | Done (accrual and cash, with months with no transfer) |
| Budgeted vs. actual | Nibo, Unimestre | Done (per category) |
| Automatic billing, bank slips (boleto), bank file exchange | All of them | No |
| Per-student delinquency tracking | Sponte (claims 30%+ reduction), Gennera | **Done** (tuition, lateness brackets, delinquency %, billing message — Loop 3) |
| Enrollment, delinquency and retention metrics | Gennera | Partial: enrollment and occupancy per child **done** (Loop 2); delinquency and retention not done |

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
3. **Metrics**: cost per child, payroll over revenue, break-even point per school, Novo Mundo vs.
   CIC comparison.
4. **Scenarios**: "what if the city hall is 2 months late?", "what if we lose 10 children?".
5. **Alerts**: vacation coming due (risk of double pay), an electricity bill above average, negative
   cash flow ahead.
6. **Severance reserve**: provision a share of the FGTS fine and notice every month for whoever
   might leave. Our own suggestion, not seen in the competitors.
7. **Export for the accountant** (Excel/PDF) and attach receipts and invoices.
8. **Users and permissions**, so the front office and the accountant can access it without editing
   everything.
9. **Bank reconciliation** (importing an OFX statement).
