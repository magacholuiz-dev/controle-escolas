// Route/query parameter validation and body helpers, with the legacy Portuguese messages.
import { isValidObjectId } from 'mongoose';
import { InputError } from '@controle-escolas/domain';

export const requireId = (v: unknown, name = 'id'): string => {
  if (!isValidObjectId(v) || String(v).length !== 24) throw new InputError(`${name} inválido`);
  return String(v);
};

export const requireYear = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new InputError('ano inválido (use um ano entre 2000 e 2100)');
  return n;
};

export const requirePeriod = (v: unknown, label = 'period'): string => {
  if (!/^\d{4}-\d{2}$/.test(String(v ?? ''))) throw new InputError(`${label} inválido (use AAAA-MM)`);
  return String(v);
};

export type Body = Record<string, unknown>;

// Copies only whitelisted fields; an empty string means "no value".
export function pickFields(cols: readonly string[], body: Body): Body {
  const out: Body = {};
  for (const c of cols) if (c in body) out[c] = body[c] === '' ? null : body[c];
  return out;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && ISO.test(v);
