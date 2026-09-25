import { InputError } from './errors';

export type ProrateMode = 'equal' | 'children' | 'manual';
export interface ProrateSchool { id: string; children_count?: number }
export interface ProrateShare { school_id: string; pct: number; amount: number }

// Splits an amount between schools. Returns one share per school, with the cents reconciled to the total.
//  - equal:    even shares
//  - children: proportional to enrollment (school's `children_count` field)
//  - manual:   percentages given in `percentages` ({ [school_id]: pct }), must add up to 100
export function prorate(total: number, schools: ProrateSchool[], mode: string, percentages: Record<string, number> = {}): ProrateShare[] {
  if (!(total > 0)) throw new InputError('o valor deve ser maior que zero');
  if (schools.length < 2) throw new InputError('é preciso ao menos duas escolas para dividir');

  let weights: number[];
  if (mode === 'equal') weights = schools.map(() => 1);
  else if (mode === 'children') {
    weights = schools.map((s) => s.children_count || 0);
    if (!weights.some((w) => w > 0)) throw new InputError('informe o número de crianças de cada escola em Parâmetros');
  } else if (mode === 'manual') {
    weights = schools.map((s) => Number(percentages[s.id]) || 0);
    const sum = weights.reduce((s, w) => s + w, 0);
    if (Math.abs(sum - 100) > 0.01) throw new InputError(`os percentuais somam ${sum}%, e devem somar 100%`);
  } else throw new InputError(`modo de divisão inválido: ${mode}`);

  const sum = weights.reduce((s, w) => s + w, 0);
  const cents = Math.round(total * 100);
  const shares = weights.map((w) => Math.floor((cents * w) / sum));
  let remainder = cents - shares.reduce((s, c) => s + c, 0);
  // Hand out the leftover cents, starting from the heaviest-weighted school.
  [...weights.keys()].sort((a, b) => (weights[b] as number) - (weights[a] as number)).forEach((i) => {
    if (remainder > 0) { shares[i] = (shares[i] as number) + 1; remainder--; }
  });
  return schools.map((s, i) => ({ school_id: s.id, pct: Math.round(((weights[i] as number) / sum) * 10000) / 100, amount: (shares[i] as number) / 100 }));
}
