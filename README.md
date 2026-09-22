# Controle Financeiro das Escolas

Local app to track cash in/out, provisions and profit for two preschools with a contract with the
Curitiba city hall (the transfer is only paid in months with classes).

## Run it

Same pattern as Kivoni: Mongoose + `MONGODB_URI` + MongoDB 7 on Docker.

```bash
npm install
npm run db       # starts MongoDB (docker compose) on port 27019
npm start        # http://localhost:3200  (Node 23.4+)
npm run demo     # same, but with sample data in the controle-escolas-demo database
npm test         # tests the calculation (no database needed)
npm run test:api # tests the API against the Docker Mongo (disposable database)
npm run backup   # backs up the database into backups/ (DB=name for a different one)
```

Without Docker, point at any MongoDB with `MONGODB_URI` (copy `.env.example` to `.env`).
The default is `mongodb://127.0.0.1:27019/controle-escolas`. Data lives in the Docker volume
`controle_escolas_mongo_data`; for backups use `npm run backup`.
To restore: `sh scripts/restore.sh backups/FILE.gz [target-database]`.

The server only listens on `127.0.0.1` (`LISTEN_HOST` changes that). Don't expose it to the
network: there's no login yet.

## How it works

- **Transfer calendar**: a factor per month and per school (default: Jan 0%, Feb 50%, Jul 0%, the
  rest 100%). Revenues and expenses marked "follows calendar" are multiplied by that factor.
- **Accrual (profit)**: revenue − salaries − benefits − payroll charges − 13th-salary provision −
  vacation provision − expenses − taxes.
- **Cash**: the 13th salary goes out 50% in Nov and 50% in Dec; the 1/3 vacation bonus goes out in
  each employee's vacation month. Taxes and other costs go out in their own month. Accumulated
  balance, worst month and the reserve needed show up on the Dashboard.
- **Ledger entries**: in closed months, cash flow uses the actual entries instead of the plan.
  "Outside the budget" (one-off) entries add to the plan even in open months.
- **Bills to pay**: due date, status (pending/overdue/paid), suppliers and a due-bills card on the
  Dashboard. "Generate this month's bills" creates one bill per recurring expense.
- **Children and derived revenue**: once the public-slot children are on file (Children tab) along
  with the rate per child-day (Settings), the city-hall revenue is calculated — children × school
  days in the month × rate — instead of typed in. **Migrate every child at once**: as soon as the
  1st one is on file, the manual "follows calendar" revenue stops counting.
- **Tuition and delinquency**: privately-funded children generate a tuition charge per billing
  period (Tuition tab). Lateness is classified into brackets (1–30, 31–60, 60+ days); the Dashboard
  shows the period's delinquency and the list of debtors, with a billing message ready to copy (no
  CPF).
- **Splitting between schools**: any expense, bill or entry can be split between Novo Mundo and CIC
  (evenly, proportional to enrollment, or by a manual percentage).
- **Severance**: full per-employee calculation (Brazilian CLT labor law), with termination applied.

## Assumptions (check these with the accountant)

- Default payroll charges 8% (FGTS only, Simples Nacional tax regime); default tax 6% of revenue.
  Both editable in Settings.
- Vacation: the vacation month's salary is already in the payroll, so the extra cost is the 1/3
  constitutional bonus (+ charges), provisioned at 1/36 of the salary per month.
- The 13th salary and the vacation bonus carry the same payroll charges.
- City-hall revenue per child: the formula was confirmed with the owner (children × school days ×
  rate per child-day), but the entry/exit mid-month proration is an approximation (calendar days) —
  not yet checked against a real invoice.

## Documentation

- [Development process (Loop Engineering)](docs/LOOP_PROCESS.md)
- [Roadmap and specs per loop](docs/ROADMAP.md)
- [Market benchmark](docs/BENCHMARK.md)
