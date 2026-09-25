// Business-health metrics built on top of a report already produced by calc.js. Pure function.
// Every ratio returns `null` instead of NaN/Infinity when it can't be computed (e.g. no children,
// no revenue) — the front shows "—" for null, never a broken number.

// Categories treated as variable (they grow with the number of children), matching the same
// budgeted+oneOff amount the income statement (Loop 4) uses.
export const VARIABLE_CATEGORIES = ['Alimentação', 'Material de cozinha', 'Material de limpeza', 'Material pedagógico'];

const div = (a, b) => (b > 0 ? a / b : null);

export function buildMetrics({ report, activeChildren }) {
  const revenue = report.totals.revenue;
  const accrualCost = report.totals.accrualCost;
  const payroll = report.totals.salaries + report.totals.benefits + report.totals.charges + report.totals.thirteenthProvision + report.totals.vacationProvision;
  const variableCost = report.categories
    .filter((c) => VARIABLE_CATEGORIES.includes(c.category))
    .reduce((s, c) => s + (c.budgeted || 0) + (c.oneOff || 0), 0);

  const costPerChild = div(accrualCost, activeChildren);
  const revenuePerChild = div(revenue, activeChildren);
  const variableCostPerChild = div(variableCost, activeChildren);
  const payrollOverRevenue = div(payroll, revenue);

  let breakEven = null;
  if (revenuePerChild != null && variableCostPerChild != null && revenuePerChild > variableCostPerChild) {
    const fixedCost = accrualCost - variableCost;
    breakEven = fixedCost <= 0 ? 0 : Math.ceil(fixedCost / (revenuePerChild - variableCostPerChild));
  }

  return { activeChildren, costPerChild, revenuePerChild, variableCostPerChild, payrollOverRevenue, breakEven, margin: report.margin };
}

// Which side wins a comparison row: 'lower' (e.g. cost per child) or 'higher' (everything else) is better.
export function betterSchool(values, direction = 'higher') {
  const known = values.filter((v) => v.value != null);
  if (!known.length) return null;
  const best = known.reduce((a, b) => {
    if (direction === 'lower') return b.value < a.value ? b : a;
    return b.value > a.value ? b : a;
  });
  return best.id;
}
