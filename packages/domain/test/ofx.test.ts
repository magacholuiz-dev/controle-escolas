import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseOfx } from '../src/ofx';

test('ofx: legacy assertions, ported 1:1', () => {

  // A hand-built OFX 1.x (SGML) sample, following the public spec: unclosed leaf tags.
  const SAMPLE = `OFXHEADER:100
  DATA:OFXSGML
  VERSION:102
  SECURITY:NONE
  ENCODING:USASCII

  <OFX>
  <BANKMSGSRSV1>
  <STMTTRNRS>
  <STMTRS>
  <BANKTRANLIST>
  <STMTTRN>
  <TRNTYPE>DEBIT
  <DTPOSTED>20260310120000
  <TRNAMT>-480.00
  <FITID>2026031000123
  <NAME>Fornecedor Seguranca
  </STMTTRN>
  <STMTTRN>
  <TRNTYPE>CREDIT
  <DTPOSTED>20260305090000
  <TRNAMT>800.00
  <FITID>2026030500045
  <NAME>Mensalidade Ana
  </STMTTRN>
  </BANKTRANLIST>
  <LEDGERBAL>
  <BALAMT>15320.55
  <DTASOF>20260331
  </LEDGERBAL>
  </STMTRS>
  </STMTRNRS>
  </BANKMSGSRSV1>
  </OFX>
  `;

  const parsed = parseOfx(SAMPLE);
  assert.equal(parsed.transactions.length, 2);
  assert.deepEqual(parsed.transactions[0], { fitid: '2026031000123', date: '2026-03-10', amount: -480, name: 'Fornecedor Seguranca', type: 'DEBIT' });
  assert.deepEqual(parsed.transactions[1], { fitid: '2026030500045', date: '2026-03-05', amount: 800, name: 'Mensalidade Ana', type: 'CREDIT' });
  assert.equal(parsed.ledgerBalance, 15320.55);
  assert.equal(parsed.ledgerDate, '2026-03-31');

  // AC5: garbage input is rejected clearly, never throws something unrecognizable.
  assert.throws(() => parseOfx('isto nao e um ofx'), /OFX/);
  assert.throws(() => parseOfx(''), /OFX/);
  assert.throws(() => parseOfx(null), /OFX/);

  // AC6: one malformed <STMTTRN> (missing amount) is skipped; the rest of the file still parses.
  const withBadEntry = SAMPLE.replace('<TRNAMT>-480.00\n', '');
  const parsedBad = parseOfx(withBadEntry);
  assert.equal(parsedBad.transactions.length, 1);
  assert.equal(parsedBad.transactions[0].fitid, '2026030500045');
  assert.equal(parsedBad.ledgerBalance, 15320.55); // the ledger balance still comes through

  // A file with only a ledger balance and no transactions is still valid (e.g. an empty-month statement).
  const onlyBalance = parseOfx('<OFX><LEDGERBAL><BALAMT>100.00\n<DTASOF>20260401\n</LEDGERBAL></OFX>');
  assert.equal(onlyBalance.transactions.length, 0);
  assert.equal(onlyBalance.ledgerBalance, 100);


});
