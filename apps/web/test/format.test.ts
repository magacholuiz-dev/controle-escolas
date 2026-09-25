import { describe, expect, it } from 'vitest';
import { brl, compact, dateBr, installmentPreview, pct, tone } from '../src/lib/format';
import { auditActionLabel, auditDetail } from '../src/lib/audit';
import { niceTicks } from '../src/components/charts';

// Locale output uses a non-breaking space between "R$" and the number.
const nb = (s: string) => s.replace(/ /g, ' ');

describe('format helpers', () => {
  it('formats money, percentages and dates like the legacy front', () => {
    expect(nb(brl(1234.5))).toBe('R$ 1.234,50');
    expect(nb(brl(null))).toBe('R$ 0,00');
    expect(pct(0.0851)).toBe('8,5%');
    expect(dateBr('2026-09-25')).toBe('25/09/2026');
  });
  it('tone marks negative and positive amounts, ignoring tiny noise', () => {
    expect([tone(-5), tone(5), tone(0.001), tone(-0.001)]).toEqual(['neg', 'pos', '', '']);
  });
  it('compact axis labels', () => {
    expect(compact(12000)).toBe('R$ 12 mil');
    expect(compact(-30000)).toBe('−R$ 30 mil');
    expect(compact(1500000)).toBe('R$ 1,5 mi');
    expect(compact(400)).toBe('R$ 400');
  });
  it('previews an installment purchase with the same rounding as the API', () => {
    expect(nb(installmentPreview('total', 3, 2000))).toBe('3x de R$ 666,67 (as últimas R$ 666,66) = total de R$ 2.000,00');
    expect(nb(installmentPreview('each', 10, 340))).toBe('10x de R$ 340,00 = total de R$ 3.400,00');
    expect(installmentPreview('total', 0, 100)).toBe('');
  });
});

describe('audit log formatting', () => {
  it('translates actions and formats before/after readably', () => {
    expect(auditActionLabel('employees.delete')).toBe('Excluiu colaborador');
    expect(auditActionLabel('something.new')).toBe('something.new');
    expect(auditDetail({ salary: 2000 }, { salary: 2500 })).toBe('salário: 2000 → salário: 2500');
    expect(auditDetail(null, { name: 'Ana' })).toBe('nome: Ana');
    expect(auditDetail(null, null)).toBe('—');
  });
});

describe('chart ticks', () => {
  it('produces round values covering the range, including zero', () => {
    const t = niceTicks(-30000, 68000);
    expect(t).toContain(0);
    expect(t[0]).toBeLessThanOrEqual(-30000);
    expect(t[t.length - 1]).toBeGreaterThan(68000 - 25000);
    expect(t.every((v) => v % 500 === 0)).toBe(true);
  });
});
