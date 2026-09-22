import assert from 'node:assert/strict';
import { ratear } from './rateio.js';

const E = [{ id: 'a', criancas: 60 }, { id: 'b', criancas: 40 }];
assert.deepEqual(ratear(100, E, 'igual'), [{ escola_id: 'a', pct: 50, valor: 50 }, { escola_id: 'b', pct: 50, valor: 50 }]);
assert.deepEqual(ratear(100, E, 'criancas').map((x) => x.valor), [60, 40]);
assert.deepEqual(ratear(100, E, 'manual', { a: 70, b: 30 }).map((x) => x.valor), [70, 30]);
// Centavos fecham o total: 0,01 dividido em duas partes não some nem duplica
assert.equal(ratear(0.01, E, 'igual').reduce((s, x) => s + x.valor, 0), 0.01);
assert.equal(ratear(100.01, [...E, { id: 'c', criancas: 10 }], 'igual').reduce((s, x) => Math.round((s + x.valor) * 100) / 100, 0), 100.01);
assert.throws(() => ratear(100, E, 'manual', { a: 70, b: 20 }), /somam 90/);
assert.throws(() => ratear(100, [{ id: 'a' }, { id: 'b' }], 'criancas'), /crianças/);
assert.throws(() => ratear(0, E, 'igual'));
console.log('ok rateio');
