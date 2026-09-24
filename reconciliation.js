// Matches an imported bank transaction against open bills/tuition charges. Pure function — the
// server is the one that actually pays anything, after a human confirms.
import { createHash } from 'node:crypto';

// Same amount, same day (or within 3 days) never collides across two different real transactions
// in practice, and re-importing the same OFX file always yields the same fingerprint.
export function fingerprint({ schoolId, date, amount, fitid }) {
  return createHash('sha256').update(`${schoolId}|${date}|${amount.toFixed(2)}|${fitid || ''}`).digest('hex');
}

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// A debit (negative) only ever suggests a bill (money going out); a credit (positive) only ever
// suggests a tuition charge (money coming in) — a receipt never pays a bill, and vice versa.
export function suggest(transaction, { bills = [], tuitions = [] } = {}) {
  const isDebit = transaction.amount < 0;
  const amount = Math.abs(transaction.amount);
  const pool = isDebit
    ? bills.map((b) => ({ kind: 'bill', id: b.id, amount: b.amount, due_date: b.due_date }))
    : tuitions.map((t) => ({ kind: 'tuition', id: t.id, amount: t.amount, due_date: t.due_date }));
  const candidates = pool
    .filter((c) => Math.abs(c.amount - amount) < 0.01 && Math.abs(daysBetween(c.due_date, transaction.date)) <= 3)
    .sort((a, b) => Math.abs(daysBetween(a.due_date, transaction.date)) - Math.abs(daysBetween(b.due_date, transaction.date)));
  return candidates[0] || null;
}
