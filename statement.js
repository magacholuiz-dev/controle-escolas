// Income statement (DRE): groups each expense category into a cost center, on top of a report
// already built by calc.js. Pure function — the invariant this exists to prove is that regrouping
// never changes the total, only where it's shown.
//
// What counts as "spent" per category, for this statement, is `budgeted + oneOff` — the exact same
// two numbers calc.js adds into `accrualCost` (budgeted expenses + one-off actual entries). Using
// the full `actual` instead would double count a category that has both a budget and ordinary
// tracking entries, and the statement would stop matching the Dashboard's profit.

export const GROUPS = ['Receita bruta', 'Deduções', 'Pessoal', 'Operacional', 'Administrativo', 'Não classificado'];

export const DEFAULT_CATEGORY_GROUPS = {
  'Alimentação': 'Operacional',
  'Aluguel': 'Administrativo',
  'Água': 'Operacional',
  'Luz': 'Operacional',
  'Internet': 'Administrativo',
  'Segurança': 'Administrativo',
  'Material de cozinha': 'Operacional',
  'Material de limpeza': 'Operacional',
  'Material pedagógico': 'Operacional',
  'Manutenção': 'Operacional',
  'Contabilidade': 'Administrativo',
  'Rescisão': 'Pessoal',
};

export function buildStatement(report, categoryGroups = DEFAULT_CATEGORY_GROUPS) {
  const amounts = new Map(GROUPS.map((g) => [g, 0]));
  const add = (group, value) => amounts.set(group, (amounts.get(group) || 0) + value);

  add('Receita bruta', report.totals.revenue);
  add('Deduções', -report.totals.taxes);
  add('Pessoal', -(report.totals.salaries + report.totals.benefits + report.totals.charges + report.totals.thirteenthProvision + report.totals.vacationProvision));

  const unclassified = [];
  for (const c of report.categories) {
    const spent = (c.budgeted || 0) + (c.oneOff || 0);
    if (!spent) continue;
    const group = categoryGroups[c.category] || 'Não classificado';
    if (group === 'Não classificado' && !unclassified.includes(c.category)) unclassified.push(c.category);
    add(group, -spent);
  }

  const groups = GROUPS.map((group) => ({ group, amount: Math.round((amounts.get(group) || 0) * 100) / 100 }));
  const result = Math.round(groups.reduce((s, g) => s + g.amount, 0) * 100) / 100;
  return { groups, result, unclassified };
}
