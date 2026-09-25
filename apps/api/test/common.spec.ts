import { InputError } from '@controle-escolas/domain';
import { parseCookies } from '../src/common/cookies';
import { checkAllowed } from '../src/common/scope';
import { pickFields, requireId, requireYear, requirePeriod } from '../src/common/validation';
import { changedFields, docSummary } from '../src/common/audit.service';
import { validationMessage } from '../src/common/http-exception.filter';
import { allowedSchoolIds } from '../src/common/session';

describe('cookies', () => {
  it('parses a Cookie header and decodes values', () => {
    expect(parseCookies('a=1; sid=abc%20def; b=')).toEqual({ a: '1', sid: 'abc def', b: '' });
    expect(parseCookies(undefined)).toEqual({});
  });
});

describe('school scope', () => {
  it('null means unrestricted; a list allows only its schools', () => {
    expect(() => checkAllowed(null, 'x')).not.toThrow();
    expect(() => checkAllowed(['a'], 'a')).not.toThrow();
    expect(() => checkAllowed(['a'], 'b')).toThrow(InputError);
    try { checkAllowed(['a'], 'b'); } catch (e) { expect((e as InputError).status).toBe(403); }
  });
  it('owners are unrestricted, directors get their school ids', () => {
    expect(allowedSchoolIds({ id: '1', email: 'a', role: 'owner', school_ids: [] })).toBeNull();
    expect(allowedSchoolIds({ id: '1', email: 'a', role: 'director', school_ids: ['s'] })).toEqual(['s']);
  });
});

describe('validation helpers', () => {
  it('requireId accepts 24-hex ids only', () => {
    expect(requireId('6ab2e08b6dce41df032284fc')).toBe('6ab2e08b6dce41df032284fc');
    expect(() => requireId('xyz')).toThrow('id inválido');
    expect(() => requireId('short', 'school_id')).toThrow('school_id inválido');
  });
  it('requireYear bounds the year', () => {
    expect(requireYear('2026')).toBe(2026);
    expect(() => requireYear(1999)).toThrow(InputError);
    expect(() => requireYear('abc')).toThrow(InputError);
  });
  it('requirePeriod expects YYYY-MM', () => {
    expect(requirePeriod('2026-06')).toBe('2026-06');
    expect(() => requirePeriod('06-2026')).toThrow('period inválido (use AAAA-MM)');
  });
  it('pickFields keeps only whitelisted fields and turns "" into null', () => {
    expect(pickFields(['a', 'b'], { a: 1, b: '', c: 3 })).toEqual({ a: 1, b: null });
  });
});

describe('audit helpers', () => {
  it('summarizes only the meaningful fields', () => {
    expect(docSummary('employees', { name: 'Ana', salary: 1, cpf: '123', extra: 1 })).toEqual({ name: 'Ana', salary: 1 });
    expect(docSummary('unknown', { a: 1 })).toEqual({});
  });
  it('reports only what changed', () => {
    expect(changedFields({ salary: 2500, name: 'Ana' }, { salary: 2000, name: 'Ana' })).toEqual({ before: { salary: 2000 }, after: { salary: 2500 }, hasChanges: true });
    expect(changedFields({ name: 'Ana' }, { name: 'Ana' }).hasChanges).toBe(false);
  });
});

describe('mongoose error messages', () => {
  it('translates validation errors into Portuguese sentences', () => {
    const e = Object.assign(new Error('x'), { name: 'ValidationError', errors: { name: { path: 'name', kind: 'required' }, salary: { path: 'salary', kind: 'min' } } });
    expect(validationMessage(e)).toBe('Preencha o campo "nome". Valor fora da faixa permitida em "salário".');
    expect(validationMessage(Object.assign(new Error('x'), { name: 'CastError', path: 'date' }))).toBe('Valor inválido no campo "data".');
  });
});
