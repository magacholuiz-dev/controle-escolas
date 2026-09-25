import { expect, test } from '@playwright/test';
import type { Bill, Employee, Expense, Revenue, School, ConsolidatedReport, Entry } from '@controle-escolas/contracts';
import { apiAs, login, nb, OWNER, pickSchool, watchErrors } from './helpers';

const NAV = ['Painel', 'Receitas', 'Crianças', 'Mensalidades', 'Equipe', 'Despesas', 'Contas a pagar', 'Fornecedores', 'Calendário de repasse', 'Lançamentos reais', 'DRE', 'Indicadores', 'Cenários', 'Conciliação bancária', 'Parâmetros', 'Usuários'];

test.describe.configure({ mode: 'serial' });

test('login: guarded pages redirect, wrong password is refused, the session survives a reload, logout ends it', async ({ page }) => {
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(OWNER.email);
  await page.getByLabel('Senha').fill('wrong-password');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('.login-error')).toContainText('email ou senha inválidos');

  await login(page);
  await page.reload();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/login$/);
});

test('every screen of the owner loads without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page);
  for (const label of NAV) {
    await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('main')).not.toContainText(/Erro:|NaN|undefined|Infinity/);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});

test('revenues: add, edit in place (saved), total, delete asks first', async ({ page, request }) => {
  await login(page);
  await page.getByRole('link', { name: 'Receitas', exact: true }).click();
  const add = page.locator('.add').first();
  await add.getByLabel('Descrição').fill('Contrato Prefeitura');
  await add.getByLabel('Valor mensal cheio').fill('40000');
  await add.getByRole('button', { name: 'Adicionar' }).click();

  const row = page.locator('.edit tbody tr').first();
  await expect(row.getByLabel('Descrição')).toHaveValue('Contrato Prefeitura');
  await row.getByLabel('Valor mensal cheio').fill('45000');
  await row.getByLabel('Valor mensal cheio').press('Enter');
  await expect(page.locator('tr.tot')).toContainText('45.000,00');

  const api = await apiAs(request);
  const revenues = await api.get<Revenue[]>('revenues');
  expect(revenues.find((r) => r.description === 'Contrato Prefeitura')?.monthly_amount).toBe(45000);

  await row.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(row.getByLabel('Descrição')).toHaveValue('Contrato Prefeitura');
  await row.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.edit tbody tr').first().getByLabel('Descrição')).toHaveCount(0);
});

test('severance: simulate, then apply — the employee is terminated and the cost is posted', async ({ page, request }) => {
  const api = await apiAs(request);
  const [school] = await api.get<School[]>('schools');
  const created = await api.post<{ id: string }>('employees', { school_id: school?.id, name: 'Ana Silva', role: 'Professora', salary: 3000, benefits: 400, hire_date: '2021-02-01', vacation_periods_taken: 2 });
  const expected = await api.get<{ schoolCost: number }>(`severance?employee_id=${created.id}&date=2026-09-22&type=without_cause&notice=paid_in_lieu&notice_worked=1`);

  await login(page);
  await page.getByRole('link', { name: 'Equipe', exact: true }).click();
  await page.locator('.edit tbody tr', { has: page.locator('input[value="Ana Silva"]') }).getByRole('button', { name: 'Rescisão' }).click();
  await expect(page.getByRole('heading', { name: 'Rescisão de Ana Silva' })).toBeVisible();
  const panel = page.locator('section.card', { hasText: 'Rescisão de Ana Silva' });
  await panel.getByLabel('Data da rescisão').fill('2026-09-22');
  await panel.getByRole('button', { name: 'Calcular' }).click();
  await expect(panel.locator('tr.strong').last()).toContainText(nb(expected.schoolCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })));

  await panel.getByRole('button', { name: 'Efetivar desligamento' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('heading', { name: 'Rescisão de Ana Silva' })).toHaveCount(0);

  const employees = await api.get<Employee[]>(`employees?school_id=${school?.id}`);
  expect(employees.find((e) => e.id === created.id)).toMatchObject({ active: 0, termination_date: '2026-09-22' });
  const entries = await api.get<Entry[]>(`entries?school_id=${school?.id}&year=2026`);
  expect(entries.find((e) => e.category === 'Rescisão')).toMatchObject({ one_off: 1, amount: expected.schoolCost });
});

test('installments: R$ 2.000 in 3x, pay one, remove the rest of the purchase', async ({ page, request }) => {
  await login(page);
  await page.getByRole('link', { name: 'Contas a pagar', exact: true }).click();
  const card = page.locator('section.card', { hasText: 'Compra parcelada' });
  await card.getByLabel('Descrição').fill('Geladeira');
  await card.getByLabel('Valor', { exact: true }).fill('2000');
  await expect(card).toContainText('3x de R$ 666,67 (as últimas R$ 666,66) = total de R$ 2.000,00');
  await card.getByRole('button', { name: 'Lançar parcelas' }).click();
  await expect(page.locator('.toast')).toContainText('3 parcelas lançadas, total de R$ 2.000,00.');

  const rows = page.locator('.edit tbody tr', { has: page.locator('input[value="Geladeira"]') });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('1/3');
  await expect(rows.nth(2)).toContainText('3/3');

  await rows.nth(0).getByRole('button', { name: 'Pagar' }).click();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('666.67'); // amount
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/); // date, not the amount left over
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(rows.nth(0)).toContainText('Paga');

  await rows.nth(1).getByRole('button', { name: 'Excluir compra' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(rows).toHaveCount(1);

  const api = await apiAs(request);
  const [school] = await api.get<School[]>('schools');
  const bills = (await api.get<Bill[]>(`bills?school_id=${school?.id}`)).filter((b) => b.description === 'Geladeira');
  expect(bills).toHaveLength(1);
  expect(bills[0]).toMatchObject({ status: 'paid', installment_no: 1, amount: 666.67 });
});

test('splitting an expense creates one per school, each with its share', async ({ page, request }) => {
  await login(page);
  await page.getByRole('link', { name: 'Despesas', exact: true }).click();
  const card = page.locator('section.card', { hasText: 'Dividir entre as escolas' });
  await card.getByLabel('Descrição').fill('Panelas');
  await card.getByLabel('Valor mensal cheio').fill('1850');
  await expect(card).toContainText('Novo Mundo: R$ 925,00 (50%) · CIC: R$ 925,00 (50%)');
  await card.getByRole('button', { name: 'Dividir e lançar' }).click();
  await expect(page.locator('.edit tbody tr', { has: page.locator('input[value="Panelas"]') })).toHaveCount(1);
  await expect(page.locator('.edit .chip')).toContainText('dividido 50%');

  const api = await apiAs(request);
  for (const s of await api.get<School[]>('schools')) {
    const list = await api.get<Expense[]>(`expenses?school_id=${s.id}`);
    expect(list.find((e) => e.description === 'Panelas')).toMatchObject({ monthly_amount: 925, total_amount: 1850, split_pct: 50 });
  }
});

test('the dashboard shows the same numbers as the API report', async ({ page, request }) => {
  const api = await apiAs(request);
  const schools = await api.get<School[]>('schools');
  for (const s of schools) {
    await api.post('revenues', { school_id: s.id, description: 'Mensalidades', monthly_amount: 12000, follows_calendar: 0 });
    await api.post('expenses', { school_id: s.id, description: 'Aluguel', category: 'Aluguel', monthly_amount: 4000 });
  }
  const report = await api.get<ConsolidatedReport>('report?year=2026&school=all');
  await login(page);
  await expect(page.locator('.hero .v')).toContainText(nb(Math.round(report.totals.result).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })));
  await expect(page.locator('.kpi', { hasText: 'Receita do ano' })).toContainText(nb(Math.round(report.totals.revenue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })));
  await expect(page.locator('section.card', { hasText: 'Por escola' }).locator('tbody tr')).toHaveCount(2);

  await pickSchool(page, 'CIC');
  const one = await api.get<ConsolidatedReport>(`report?year=2026&school=${schools[1]?.id}`);
  await expect(page.locator('.hero .v')).toContainText(nb(Math.round(one.totals.result).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })));
});

test('scenarios: simulate without writing, save and delete', async ({ page, request }) => {
  await login(page);
  await page.getByRole('link', { name: 'Cenários', exact: true }).click();
  await page.getByLabel('Meses de atraso').fill('2');
  await page.getByRole('button', { name: 'Adicionar ajuste' }).click();
  await expect(page.getByText('Atrasar o repasse em 2 mês(es)')).toBeVisible();
  await page.getByRole('button', { name: 'Simular' }).click();
  await expect(page.getByRole('cell', { name: 'Pior saldo de caixa' })).toBeVisible();
  await page.getByLabel('Nome do cenário').fill('Repasse atrasado');
  await page.getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(page.getByRole('cell', { name: 'Repasse atrasado' })).toBeVisible();
  await page.getByRole('row', { name: /Repasse atrasado/ }).getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('cell', { name: 'Repasse atrasado' })).toHaveCount(0);
  const api = await apiAs(request);
  const [school] = await api.get<School[]>('schools');
  expect(await api.get<unknown[]>(`scenarios?school_id=${school?.id}`)).toHaveLength(0);
});

test('bank: import an OFX, the bill is suggested, confirming pays it', async ({ page, request }) => {
  const api = await apiAs(request);
  const [school] = await api.get<School[]>('schools');
  await api.post('bills', { school_id: school?.id, description: 'Internet', category: 'Internet', period: '2026-03', due_date: '2026-03-08', amount: 480 });
  const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20260310\n<TRNAMT>-480.00\n<FITID>e2e-1\n<NAME>PAGAMENTO INTERNET\n</STMTTRN>\n</BANKTRANLIST><LEDGERBAL><BALAMT>1000.00<DTASOF>20260311</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  await login(page);
  await page.getByRole('link', { name: 'Conciliação bancária', exact: true }).click();
  await page.getByLabel('Arquivo OFX').setInputFiles({ name: 'extrato.ofx', mimeType: 'application/x-ofx', buffer: Buffer.from(ofx) });
  await page.getByRole('button', { name: 'Importar extrato (.ofx)' }).click();
  await expect(page.locator('.toast')).toContainText('1 movimento(s) novo(s) importado(s)');
  const row = page.getByRole('row', { name: /PAGAMENTO INTERNET/ });
  await expect(row).toContainText('Conta: Internet');
  await expect(row).toContainText('Pendente');
  await row.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(row).toContainText('Conciliado');
  const bills = await api.get<Bill[]>(`bills?school_id=${school?.id}&period=2026-03`);
  expect(bills.find((b) => b.description === 'Internet')).toMatchObject({ status: 'paid', paid_at: '2026-03-10' });
});

test('calendar and settings edits are saved', async ({ page, request }) => {
  await login(page);
  await page.getByRole('link', { name: 'Calendário de repasse', exact: true }).click();
  const factor = page.getByRole('row', { name: /Fator de repasse/ }).getByLabel('Fator de repasse').first();
  await factor.fill('0.3');
  await factor.press('Enter');
  await page.getByRole('link', { name: 'Parâmetros', exact: true }).click();
  const capacity = page.locator('.edit tbody tr').first().getByLabel('Capacidade (vagas)');
  await capacity.fill('80');
  await capacity.press('Enter');
  await expect.poll(async () => {
    const api = await apiAs(request);
    const [school] = await api.get<School[]>('schools');
    const cal = await api.get<{ month: number; factor: number }[]>(`calendar?school_id=${school?.id}&year=${new Date().getFullYear()}`);
    return [cal[0]?.factor, school?.capacity];
  }).toEqual([0.3, 80]);
});

test('users: the owner creates a director, the director only sees her school; the log records it', async ({ page, request, browser }) => {
  await login(page);
  await page.getByRole('link', { name: 'Usuários', exact: true }).click();
  const card = page.locator('section.card', { hasText: 'Criar usuário' });
  await card.getByLabel('E-mail').fill('diretora@e2e.local');
  await card.getByLabel('Senha').fill('director-password');
  await card.getByLabel('CIC').check();
  await card.getByRole('button', { name: 'Criar usuário' }).click();
  await expect(page.getByRole('row', { name: /^diretora@e2e.local Diretora/ })).toContainText('CIC');
  await expect(page.getByRole('row', { name: /Criou um usuário/ }).first()).toContainText('dona@e2e.local');

  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:3310' });
  const director = await ctx.newPage();
  await login(director, { email: 'diretora@e2e.local', password: 'director-password' });
  await expect(director.getByLabel('Escola', { exact: true }).locator('option')).toHaveText(['Todas (consolidado)', 'CIC']);
  await expect(director.getByRole('navigation').getByRole('link', { name: 'Usuários' })).toHaveCount(0);
  const api = await apiAs(request);
  const schools = await api.get<School[]>('schools');
  const forbidden = await director.evaluate(async (id) => (await fetch(`/api/employees?school_id=${id}`)).status, schools[0]?.id);
  expect(forbidden).toBe(403);
  await ctx.close();
});

test('mobile: no horizontal page scroll on the busiest screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  for (const label of ['Painel', 'Contas a pagar', 'Equipe', 'Conciliação bancária']) {
    await page.getByRole('button', { name: 'Abrir menu' }).click(); // on phones the navigation is a drawer
    await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${label} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    await expect(page.getByRole('navigation')).not.toBeInViewport(); // the drawer closes after choosing
    await expect(page.locator('.tabbar')).toBeVisible();
  }
});

test('both color schemes render the dashboard', async ({ page }) => {
  await login(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.locator('.hero')).toBeVisible();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(scheme === 'light' ? 'rgb(245, 242, 234)' : 'rgb(15, 21, 18)');
  }
});
