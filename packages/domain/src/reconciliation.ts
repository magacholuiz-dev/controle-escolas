// Matches an imported bank transaction against open bills/tuition charges. The server is the one
// that actually pays anything, after a human confirms.
import { createHash } from 'node:crypto';
import type { Iso } from './types';

// Same amount, same day (or within 3 days) never collides across two different real transactions
// in practice, and re-importing the same OFX file always yields the same fingerprint.
export function fingerprint({ schoolId, date, amount, fitid }: { schoolId: string; date: Iso; amount: number; fitid?: string }): string {
  return createHash('sha256').update(`${schoolId}|${date}|${amount.toFixed(2)}|${fitid || ''}`).digest('hex');
}

const daysBetween = (a: Iso, b: Iso): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export interface Payable { id: string; amount: number; due_date: Iso }
export interface Suggestion { kind: 'bill' | 'tuition'; id: string; amount: number; due_date: Iso }

// A debit (negative) only ever suggests a bill (money going out); a credit (positive) only ever
// suggests a tuition charge (money coming in) — a receipt never pays a bill, and vice versa.
export function suggest(
  transaction: { date: Iso; amount: number },
  { bills = [], tuitions = [] }: { bills?: Payable[]; tuitions?: Payable[] } = {},
): Suggestion | null {
  const isDebit = transaction.amount < 0;
  const amount = Math.abs(transaction.amount);
  const pool: Suggestion[] = isDebit
    ? bills.map((b) => ({ kind: 'bill', id: b.id, amount: b.amount, due_date: b.due_date }))
    : tuitions.map((t) => ({ kind: 'tuition', id: t.id, amount: t.amount, due_date: t.due_date }));
  const candidates = pool
    .filter((c) => Math.abs(c.amount - amount) < 0.01 && Math.abs(daysBetween(c.due_date, transaction.date)) <= 3)
    .sort((a, b) => Math.abs(daysBetween(a.due_date, transaction.date)) - Math.abs(daysBetween(b.due_date, transaction.date)));
  return candidates[0] ?? null;
}
