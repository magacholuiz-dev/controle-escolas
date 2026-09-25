import { test } from 'vitest';
import assert from 'node:assert/strict';
import { toCsv, payrollRows, PAYROLL_COLUMNS, statementRows, STATEMENT_COLUMNS, paidBillsRows, BILLS_COLUMNS, entriesRows, ENTRIES_COLUMNS } from '../src/export';

test('export: legacy assertions, ported 1:1', () => {

  // AC2: separator ";", decimal ",", BOM, and a description with ";", '"' and a newline all survive.
  const adversarial = toCsv([{ name: 'Diz "oi"; e quebra\nlinha', amount: 1234.5 }], [{ key: 'name', label: 'Nome' }, { key: 'amount', label: 'Valor', type: 'number' }]);
  assert.equal(adversarial[0], '﻿'[0]); // BOM first
  assert.ok(adversarial.startsWith('﻿Nome;Valor'));
  assert.ok(adversarial.includes('"Diz ""oi""; e quebra\nlinha";1234,50'));
  // A plain field with no special characters is never quoted.
  assert.ok(toCsv([{ name: 'Ana', amount: 10 }], [{ key: 'name', label: 'Nome' }, { key: 'amount', label: 'Valor', type: 'number' }]).includes('Ana;10,00'));

  // AC1: payroll lists active employees, and someone terminated mid-month still counts that month.
  const employees = [
    { name: 'Ana', role: 'Professora', cpf: '1', salary: 3000, benefits: 500, active: 1 },
    { name: 'Bia', role: 'Auxiliar', cpf: '2', salary: 2000, benefits: 0, active: 0, termination_date: '2026-06-15' },
    { name: 'Caio', role: 'Auxiliar', cpf: '3', salary: 2200, benefits: 0, active: 0, termination_date: '2026-05-20' },
  ];
  const june = payrollRows(employees, '2026-06');
  assert.deepEqual(june.map((r) => r.name), ['Ana', 'Bia']); // Caio left before June
  assert.equal(june.reduce((s, r) => s + r.salary, 0), 3000 + 2000);
  const csv = toCsv(june, PAYROLL_COLUMNS);
  assert.ok(csv.includes('Ana;Professora;1;3000,00;500,00'));
  assert.ok(!csv.includes('Caio'));

  // AC3: the statement export mirrors buildStatement's groups plus a "Resultado" line equal to statement.result.
  const statement = { groups: [{ group: 'Receita bruta', amount: 1000 }, { group: 'Pessoal', amount: -400 }], result: 600 };
  const rows = statementRows(statement);
  assert.equal(rows.length, 3);
  assert.equal(rows.at(-1), rows.find((r) => r.group === 'Resultado'));
  assert.equal(rows.at(-1).amount, 600);
  assert.ok(toCsv(rows, STATEMENT_COLUMNS).includes('Resultado;600,00'));

  // AC4: only paid bills, and only within the requested period, using amount_paid over amount.
  const bills = [
    { description: 'Luz', category: 'Luz', period: '2026-06', due_date: '2026-06-10', paid_at: '2026-06-09', amount: 100, amount_paid: 112.5 },
    { description: 'Água', category: 'Água', period: '2026-06', due_date: '2026-06-10', paid_at: null, amount: 80 }, // not paid
    { description: 'Internet', category: 'Internet', period: '2026-07', due_date: '2026-07-10', paid_at: '2026-07-09', amount: 250 }, // different period
  ];
  const paidJune = paidBillsRows(bills, '2026-06');
  assert.deepEqual(paidJune.map((r) => r.description), ['Luz']);
  assert.equal(paidJune[0].amount_paid, 112.5);
  assert.equal(paidBillsRows(bills, null).length, 2); // no period filter: every paid bill

  // AC5: entries export keeps the same rows/order as given (server is responsible for the actual order).
  const entries = [{ date: '2026-03-10', type: 'expense', category: 'Luz', description: 'Conta', amount: 12 }, { date: '2026-03-05', type: 'revenue', category: '', description: '', amount: 100 }];
  const eRows = entriesRows(entries);
  assert.deepEqual(eRows.map((r) => r.type), ['Despesa', 'Receita']);
  assert.ok(toCsv(eRows, ENTRIES_COLUMNS).includes('2026-03-10;Despesa;Luz;Conta;12,00'));


});
