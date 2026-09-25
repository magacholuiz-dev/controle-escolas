import assert from 'node:assert/strict';
import { fingerprint, suggest } from './reconciliation.js';

// fingerprint: same inputs -> same hash; any single field changing -> a different hash.
const base = { schoolId: 'e1', date: '2026-03-10', amount: -480, fitid: 'f1' };
assert.equal(fingerprint(base), fingerprint({ ...base }));
assert.notEqual(fingerprint(base), fingerprint({ ...base, date: '2026-03-11' }));
assert.notEqual(fingerprint(base), fingerprint({ ...base, amount: -480.01 }));
assert.notEqual(fingerprint(base), fingerprint({ ...base, fitid: 'f2' }));
assert.notEqual(fingerprint(base), fingerprint({ ...base, schoolId: 'e2' }));

// AC2: a R$480 debit within 3 days of a R$480 bill's due date matches; at 4 days, it doesn't.
const bills = [{ id: 'b1', amount: 480, due_date: '2026-03-08' }];
assert.equal(suggest({ date: '2026-03-10', amount: -480 }, { bills })?.id, 'b1'); // 2 days
assert.equal(suggest({ date: '2026-03-11', amount: -480 }, { bills })?.id, 'b1'); // exactly 3 days
assert.equal(suggest({ date: '2026-03-12', amount: -480 }, { bills }), null); // 4 days: no match
assert.equal(suggest({ date: '2026-03-05', amount: -480 }, { bills })?.id, 'b1'); // 3 days early also counts

// A credit never matches a bill, even with the exact amount/date, and vice versa for tuition.
assert.equal(suggest({ date: '2026-03-10', amount: 480 }, { bills }), null);
const tuitions = [{ id: 't1', amount: 800, due_date: '2026-03-05' }];
assert.equal(suggest({ date: '2026-03-06', amount: 800 }, { tuitions })?.id, 't1');
assert.equal(suggest({ date: '2026-03-06', amount: -800 }, { tuitions }), null);

// The amount must match to the cent; a mismatched amount within the date window still doesn't suggest.
assert.equal(suggest({ date: '2026-03-08', amount: -481 }, { bills }), null);

// With several candidates, the closest due date wins.
const twoBills = [{ id: 'far', amount: 100, due_date: '2026-03-01' }, { id: 'near', amount: 100, due_date: '2026-03-09' }];
assert.equal(suggest({ date: '2026-03-10', amount: -100 }, { bills: twoBills })?.id, 'near');

// No candidates at all: null, never throws.
assert.equal(suggest({ date: '2026-03-10', amount: -100 }, {}), null);
assert.equal(suggest({ date: '2026-03-10', amount: -100 }), null);

console.log('ok reconciliation');
