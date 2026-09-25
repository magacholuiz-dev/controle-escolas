// CSV exports for the accountant. Pure formatting only — every number here was already computed by
// calc/statement/the models; this file just lays it out as text.
//
// Format: `;` as the field separator and `,` as the decimal mark, matching what a Brazilian-locale
// Excel expects when a CSV is opened by double-click. A UTF-8 BOM is prepended so Excel on Windows
// doesn't mangle accented characters.
import type { EmployeeInput, EntryInput, Iso, Period } from './types';
import type { Statement } from './statement';

export interface CsvColumn { key: string; label: string; type?: 'number' }
export type CsvRow = Record<string, unknown>;

const escapeField = (value: unknown): string => {
  const s = String(value ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const formatNumber = (n: unknown): string => Number(n).toFixed(2).replace('.', ',');

export function toCsv(rows: CsvRow[], columns: CsvColumn[]): string {
  const header = columns.map((c) => escapeField(c.label)).join(';');
  const lines = rows.map((row) => columns.map((c) => {
    const value = row[c.key];
    return c.type === 'number' ? formatNumber(value || 0) : escapeField(value);
  }).join(';'));
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}

export function payrollRows(employees: (EmployeeInput & { role?: string; cpf?: string; name?: string })[], month: Period): CsvRow[] {
  return employees
    .filter((e) => e.active || (e.termination_date && e.termination_date.slice(0, 7) >= month))
    .map((e) => ({ name: e.name, role: e.role || '', cpf: e.cpf || '', salary: e.salary, benefits: e.benefits || 0 }));
}
export const PAYROLL_COLUMNS: CsvColumn[] = [
  { key: 'name', label: 'Nome' }, { key: 'role', label: 'Cargo' }, { key: 'cpf', label: 'CPF' },
  { key: 'salary', label: 'Salário', type: 'number' }, { key: 'benefits', label: 'Benefícios', type: 'number' },
];

export function statementRows(statement: Pick<Statement, 'groups' | 'result'>): CsvRow[] {
  return [...statement.groups, { group: 'Resultado', amount: statement.result }];
}
export const STATEMENT_COLUMNS: CsvColumn[] = [{ key: 'group', label: 'Grupo' }, { key: 'amount', label: 'Valor', type: 'number' }];

interface PaidBillLike { description: string; category: string; period: Period; due_date: Iso; paid_at?: Iso | null; amount_paid?: number | null; amount: number }
export function paidBillsRows(bills: PaidBillLike[], period: Period | null): CsvRow[] {
  return bills
    .filter((b) => b.paid_at && (!period || b.period === period))
    .map((b) => ({ description: b.description, category: b.category, period: b.period, due_date: b.due_date, paid_at: b.paid_at, amount_paid: b.amount_paid ?? b.amount }));
}
export const BILLS_COLUMNS: CsvColumn[] = [
  { key: 'description', label: 'Descrição' }, { key: 'category', label: 'Categoria' }, { key: 'period', label: 'Competência' },
  { key: 'due_date', label: 'Vencimento' }, { key: 'paid_at', label: 'Pago em' }, { key: 'amount_paid', label: 'Valor pago', type: 'number' },
];

export function entriesRows(entries: EntryInput[]): CsvRow[] {
  return entries.map((e) => ({ date: e.date, type: e.type === 'revenue' ? 'Receita' : 'Despesa', category: e.category, description: e.description || '', amount: e.amount }));
}
export const ENTRIES_COLUMNS: CsvColumn[] = [
  { key: 'date', label: 'Data' }, { key: 'type', label: 'Tipo' }, { key: 'category', label: 'Categoria' },
  { key: 'description', label: 'Descrição' }, { key: 'amount', label: 'Valor', type: 'number' },
];
