import assert from 'node:assert/strict';
import { prorate } from './proration.js';

const S = [{ id: 'a', children_count: 60 }, { id: 'b', children_count: 40 }];
assert.deepEqual(prorate(100, S, 'equal'), [{ school_id: 'a', pct: 50, amount: 50 }, { school_id: 'b', pct: 50, amount: 50 }]);
assert.deepEqual(prorate(100, S, 'children').map((x) => x.amount), [60, 40]);
assert.deepEqual(prorate(100, S, 'manual', { a: 70, b: 30 }).map((x) => x.amount), [70, 30]);
// Cents reconcile to the total: splitting R$0.01 in two never disappears nor doubles
assert.equal(prorate(0.01, S, 'equal').reduce((s, x) => s + x.amount, 0), 0.01);
assert.equal(prorate(100.01, [...S, { id: 'c', children_count: 10 }], 'equal').reduce((s, x) => Math.round((s + x.amount) * 100) / 100, 0), 100.01);
assert.throws(() => prorate(100, S, 'manual', { a: 70, b: 20 }), /somam 90/);
assert.throws(() => prorate(100, [{ id: 'a' }, { id: 'b' }], 'children'), /crianças/);
assert.throws(() => prorate(0, S, 'equal'));
console.log('ok proration');
