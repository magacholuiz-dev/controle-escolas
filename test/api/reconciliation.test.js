import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo;

before(async () => {
  api = await start();
  [novoMundo] = await api.schools();
});
after(() => api.stop());

const ofxSample = (transactions) => `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
${transactions.join('\n')}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1000.00
<DTASOF>20260310
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const trn = ({ type = 'DEBIT', date = '20260310', amount = '-480.00', fitid = '1001', name = 'PAGAMENTO' }) => `<STMTTRN>
<TRNTYPE>${type}
<DTPOSTED>${date}
<TRNAMT>${amount}
<FITID>${fitid}
<NAME>${name}
</STMTTRN>`;

test('AC1: importing the same OFX twice never duplicates transactions', async () => {
  const ofx = ofxSample([trn({ fitid: 'dup1' }), trn({ fitid: 'dup2', amount: '800.00', type: 'CREDIT' })]);
  const first = await api.req('POST', '/api/bank/import', { school_id: novoMundo.id, ofx });
  assert.equal(first.status, 201);
  assert.equal(first.body.imported, 2);
  assert.equal(first.body.duplicates, 0);

  const second = await api.req('POST', '/api/bank/import', { school_id: novoMundo.id, ofx });
  assert.equal(second.body.imported, 0);
  assert.equal(second.body.duplicates, 2);

  const list = (await api.req('GET', `/api/bank/list?school=${novoMundo.id}`)).body;
  assert.equal(list.length, 2);
});

test('AC3: confirming a suggestion pays the bill and creates an entry; unconfirmed, nothing changes', async () => {
  const bill = (await api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'Água', category: 'Água', period: '2026-03', due_date: '2026-03-08', amount: 480 })).body;
  const ofx = ofxSample([trn({ fitid: 'bill-match', date: '20260310', amount: '-480.00' })]);
  await api.req('POST', '/api/bank/import', { school_id: novoMundo.id, ofx });
  const [tx] = (await api.req('GET', `/api/bank/list?school=${novoMundo.id}`)).body;
  assert.equal(tx.suggested_kind, 'bill');
  assert.equal(tx.suggested_id, bill.id);

  // Before confirming: the bill is still pending, no new entry.
  const before = (await api.req('GET', `/api/bills?school_id=${novoMundo.id}&period=2026-03`)).body.find((b) => b.id === bill.id);
  assert.equal(before.paid_at, null);

  const confirm = await api.req('POST', `/api/bank/${tx.id}/confirm`, {});
  assert.equal(confirm.status, 200);
  const after = (await api.req('GET', `/api/bills?school_id=${novoMundo.id}&period=2026-03`)).body.find((b) => b.id === bill.id);
  assert.ok(after.paid_at);

  const entries = (await api.req('GET', `/api/entries?school_id=${novoMundo.id}&year=2026`)).body;
  assert.ok(entries.some((e) => e.id === confirm.body.entry_id));

  const reConfirm = await api.req('POST', `/api/bank/${tx.id}/confirm`, {});
  assert.equal(reConfirm.status, 400);
});

test('AC4: a transaction with no suggestion becomes a manual entry, linked to the transaction', async () => {
  const ofx = ofxSample([trn({ fitid: 'unmatched', date: '20260315', amount: '-73.20' })]);
  await api.req('POST', '/api/bank/import', { school_id: novoMundo.id, ofx });
  const tx = (await api.req('GET', `/api/bank/list?school=${novoMundo.id}`)).body.find((t) => t.fitid === 'unmatched');
  assert.equal(tx.suggested_kind, null);

  const manual = await api.req('POST', `/api/bank/${tx.id}/manual`, { category: 'Material de limpeza', description: 'Compra avulsa' });
  assert.equal(manual.status, 200);
  const entries = (await api.req('GET', `/api/entries?school_id=${novoMundo.id}&year=2026`)).body;
  const entry = entries.find((e) => e.id === manual.body.entry_id);
  assert.equal(entry.category, 'Material de limpeza');
  assert.equal(entry.amount, 73.2);

  const list = (await api.req('GET', `/api/bank/list?school=${novoMundo.id}`)).body.find((t) => t.id === tx.id);
  assert.equal(list.reconciled, true);
});

test('AC5: an unrecognizable OFX is rejected with 400, never crashes the server', async () => {
  const r = await api.req('POST', '/api/bank/import', { school_id: novoMundo.id, ofx: 'not an ofx file at all' });
  assert.equal(r.status, 400);

  const stillWorks = await api.req('GET', '/api/schools');
  assert.equal(stillWorks.status, 200);
});

test('AC6: one malformed transaction inside an otherwise valid OFX is skipped, not fatal', async () => {
  const malformed = `<STMTTRN>
<TRNTYPE>DEBIT
<FITID>broken-no-amount-or-date
</STMTTRN>`;
  const ofx = ofxSample([trn({ fitid: 'good-one', date: '20260320', amount: '-15.00' }), malformed]);
  const r = await api.req('POST', '/api/bank/import', { school_id: novoMundo.id, ofx });
  assert.equal(r.status, 201);
  assert.equal(r.body.imported, 1);
});
