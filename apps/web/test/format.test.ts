import { describe, expect, it } from 'vitest';
import { brl, compact, dateBr, dateBrToIso, formatMoneyInput, installmentPreview, isoToBr, isoToMonthBr, maskDateBr, maskMonthBr, monthBrToIso, parseNumberBr, pct, tone } from '../src/lib/format';
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

describe('pt-BR input parsing', () => {
  it('reads money and numbers the way people type them', () => {
    expect(parseNumberBr('R$ 1.234,56')).toBe(1234.56);
    expect(parseNumberBr('1234,5')).toBe(1234.5);
    expect(parseNumberBr('2.000')).toBe(2000);
    expect(parseNumberBr('12.5')).toBe(12.5);
    expect(parseNumberBr('0,3')).toBe(0.3);
    expect(parseNumberBr('')).toBeNull();
    expect(parseNumberBr('abc')).toBeNull();
    expect(parseNumberBr('1,2,3')).toBeNull();
  });
  it('formats money as R$ with a decimal comma', () => {
    expect(formatMoneyInput(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });
  it('converts dd/mm/aaaa to ISO and rejects impossible dates', () => {
    expect(dateBrToIso('22/09/2026')).toBe('2026-09-22');
    expect(dateBrToIso('22092026')).toBe('2026-09-22');
    expect(dateBrToIso('31/02/2026')).toBeNull();
    expect(dateBrToIso('2026-09-22')).toBeNull();
    expect(dateBrToIso('22/09/26')).toBeNull();
    expect(dateBrToIso('29/02/2028')).toBe('2028-02-29');
  });
  it('masks while typing and round-trips months', () => {
    expect(maskDateBr('22092026')).toBe('22/09/2026');
    expect(maskDateBr('2209')).toBe('22/09');
    expect(maskMonthBr('092026')).toBe('09/2026');
    expect(monthBrToIso('09/2026')).toBe('2026-09');
    expect(monthBrToIso('13/2026')).toBeNull();
    expect(isoToMonthBr('2026-09')).toBe('09/2026');
    expect(isoToBr('2026-09-22')).toBe('22/09/2026');
  });
});
