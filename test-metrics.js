import assert from 'node:assert/strict';
import { calculateSchool } from './calc.js';
import { buildMetrics, betterSchool } from './metrics.js';

const factors = Array(12).fill(1);
const report = calculateSchool({
  school: { payroll_tax_pct: 0, tax_pct: 0, initial_balance: 0, vacation_month: 1 },
  employees: [{ salary: 3000, benefits: 0, active: 1 }], // payroll = 3000*12 + 13th/vacation provisions
  revenues: [{ monthly_amount: 10000, follows_calendar: 0 }], // revenue = 120000/year
  expenses: [
    { monthly_amount: 400, category: 'Alimentação', follows_calendar: 0 }, // variable: 4800/year
    { monthly_amount: 200, category: 'Aluguel', follows_calendar: 0 }, // fixed
  ],
  factors, entries: [], year: 2026,
});

// AC1: cost and revenue per child, checked by hand against the report totals.
const m = buildMetrics({ report, activeChildren: 10 });
assert.equal(m.costPerChild, report.totals.accrualCost / 10);
assert.equal(m.revenuePerChild, report.totals.revenue / 10);
assert.equal(m.variableCostPerChild, 4800 / 10);

// AC5: payroll over revenue, and null with zero revenue.
const payroll = report.totals.salaries + report.totals.benefits + report.totals.charges + report.totals.thirteenthProvision + report.totals.vacationProvision;
assert.equal(m.payrollOverRevenue, payroll / report.totals.revenue);
const noRevenue = calculateSchool({ ...report, school: report.school ?? { payroll_tax_pct: 0, tax_pct: 0, initial_balance: 0, vacation_month: 1 }, employees: [], revenues: [], expenses: [], factors, entries: [], year: 2026 });
assert.equal(buildMetrics({ report: noRevenue, activeChildren: 5 }).payrollOverRevenue, null);

// AC3: no children on file -> every ratio is null, never NaN/Infinity.
const zero = buildMetrics({ report, activeChildren: 0 });
for (const k of ['costPerChild', 'revenuePerChild', 'variableCostPerChild', 'breakEven']) {
  assert.equal(zero[k], null, `${k} should be null with zero children`);
}

// AC2: break-even's exact boundary. Build a report where the numbers work out to a round N.
// revenuePerChild=1000, variableCostPerChild=200 -> margin 800/child; fixedCost = accrualCost - variableCost.
const be = calculateSchool({
  school: { payroll_tax_pct: 0, tax_pct: 0, initial_balance: 0, vacation_month: 1 },
  employees: [{ salary: 4000, benefits: 0, active: 1 }], // fixed payroll cost
  revenues: [{ monthly_amount: 100000 / 12, follows_calendar: 0 }], // revenue/year = 100000, /10 children = 10000... use round numbers below instead
  expenses: [{ monthly_amount: 2000 / 12, category: 'Alimentação', follows_calendar: 0 }],
  factors, entries: [], year: 2026,
});
// Pick activeChildren so the division comes out exact: revenuePerChild = 100000/10=10000, variableCostPerChild=2000/10=200.
const beMetrics = buildMetrics({ report: be, activeChildren: 10 });
const fixedCost = be.totals.accrualCost - 2000;
const expectedN = Math.ceil(fixedCost / (beMetrics.revenuePerChild - beMetrics.variableCostPerChild));
assert.equal(beMetrics.breakEven, expectedN);
// At exactly breakEven children, revenue - variable - fixed >= 0; one fewer, negative.
const atBreakEven = beMetrics.breakEven * beMetrics.revenuePerChild - beMetrics.breakEven * beMetrics.variableCostPerChild - fixedCost;
const oneLess = (beMetrics.breakEven - 1) * beMetrics.revenuePerChild - (beMetrics.breakEven - 1) * beMetrics.variableCostPerChild - fixedCost;
assert.ok(atBreakEven >= -0.005, `expected >= 0 at break-even, got ${atBreakEven}`);
assert.ok(oneLess < 0, `expected < 0 one child short, got ${oneLess}`);

// break-even is null when the margin per child is zero or negative (adding children never helps).
const noMargin = buildMetrics({ report: be, activeChildren: 1 }); // 1 child: revenuePerChild=100000, variableCostPerChild=2000 -> still positive margin, not a good counter-example
// Force a losing-margin case directly:
assert.equal((() => {
  const r = { totals: { revenue: 100, accrualCost: 500, salaries: 0, benefits: 0, charges: 0, thirteenthProvision: 0, vacationProvision: 0 }, categories: [{ category: 'Alimentação', budgeted: 200, oneOff: 0 }], margin: 0 };
  return buildMetrics({ report: r, activeChildren: 10 }).breakEven;
})(), null);

// betterSchool: lower wins for cost, higher wins for everything else; ties/missing values handled.
assert.equal(betterSchool([{ id: 'a', value: 100 }, { id: 'b', value: 80 }], 'lower'), 'b');
assert.equal(betterSchool([{ id: 'a', value: 100 }, { id: 'b', value: 80 }], 'higher'), 'a');
assert.equal(betterSchool([{ id: 'a', value: null }, { id: 'b', value: 80 }], 'higher'), 'b');
assert.equal(betterSchool([{ id: 'a', value: null }, { id: 'b', value: null }], 'higher'), null);

console.log('ok metrics');
