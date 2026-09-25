// The TypeScript port must reproduce, exactly, what the legacy JavaScript computed (see
// contract/golden/generate.mjs). Outputs are compared after a JSON round trip, cents included.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as d from '../src';

interface GoldenCase { fn: string; args: unknown[]; expect?: unknown; throws?: { message: string; status: number | null } }
const cases: GoldenCase[] = JSON.parse(readFileSync(resolve(__dirname, '../../../contract/golden/golden.json'), 'utf8'));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<string, (...args: any[]) => unknown> = {
  calculateSchool: d.calculateSchool, buildStatement: d.buildStatement, buildMetrics: d.buildMetrics, consolidate: d.consolidate,
  betterSchool: d.betterSchool, activeInMonth: d.activeInMonth, calculateSeverance: d.calculateSeverance, prorate: d.prorate,
  buildInstallments: d.buildInstallments, billDueDateForMonth: d.billDueDateForMonth, billStatus: d.billStatus,
  generateMonthBills: d.generateMonthBills, dueSummary: d.dueSummary, isActiveOn: d.isActiveOn, activeFractionInMonth: d.activeFractionInMonth,
  publicRevenueForMonth: d.publicRevenueForMonth, occupancy: d.occupancy, validateChild: d.validateChild, calculateCharge: d.calculateCharge,
  tuitionDueDateForMonth: d.tuitionDueDateForMonth, generateMonthTuition: d.generateMonthTuition, overdueBracket: d.overdueBracket,
  delinquency: d.delinquency, chargeMessage: d.chargeMessage, applyAdjustments: d.applyAdjustments, vacationAlerts: d.vacationAlerts,
  billAboveAverageAlerts: d.billAboveAverageAlerts, negativeCashAlerts: d.negativeCashAlerts, generateAlerts: d.generateAlerts,
  toCsv: d.toCsv, payrollRows: d.payrollRows, statementRows: d.statementRows, paidBillsRows: d.paidBillsRows, entriesRows: d.entriesRows,
  parseOfx: d.parseOfx, fingerprint: d.fingerprint, suggest: d.suggest, verifyPassword: d.verifyPassword,
  canAccessSchool: d.canAccessSchool, isLocked: d.isLocked,
  'recordFailedAttempt#count': (u: d.LockState) => { const r = d.recordFailedAttempt(u); return { failed_attempts: r.failed_attempts, locked: !!r.locked_until }; },
};

const roundTrip = (v: unknown): unknown => JSON.parse(JSON.stringify(v === undefined ? null : v));

describe('golden numbers: TypeScript domain equals the legacy JavaScript', () => {
  it('has a registered implementation for every golden function', () => {
    expect([...new Set(cases.map((c) => c.fn))].filter((fn) => !registry[fn])).toEqual([]);
  });

  const byFn = new Map<string, GoldenCase[]>();
  for (const c of cases) byFn.set(c.fn, [...(byFn.get(c.fn) ?? []), c]);
  for (const [fn, list] of byFn) {
    it(`${fn} (${list.length} cases)`, () => {
      list.forEach((c, i) => {
        const impl = registry[fn] as (...args: unknown[]) => unknown;
        const args = JSON.parse(JSON.stringify(c.args));
        if (c.throws) {
          let error: (Error & { status?: number }) | undefined;
          try { impl(...args); } catch (e) { error = e as Error; }
          expect(error, `${fn}#${i} should throw "${c.throws.message}"`).toBeDefined();
          expect((error as Error).message).toBe(c.throws.message);
          if (c.throws.status != null) expect((error as { status?: number }).status).toBe(c.throws.status);
        } else {
          expect(roundTrip(impl(...args)), `${fn}#${i} ${JSON.stringify(c.args).slice(0, 200)}`).toEqual(roundTrip(c.expect));
        }
      });
    });
  }
});
