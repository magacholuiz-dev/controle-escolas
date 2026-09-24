// Tolerant OFX 1.x parser. OFX 1.x is SGML, not XML: tags like `<TRNAMT>-480.00` are often never
// closed — the next tag simply starts. We turn that into well-formed pseudo-XML (closing every leaf
// tag right before the next `<`) and then pull out just the two shapes a bank statement actually
// has: a flat list of `<STMTTRN>` transactions and one `<LEDGERBAL>`. No general XML parser, no new
// dependency — real OFX statements are this flat.
//
// Not verified against a real bank export in this session (no file was available) — tested against
// hand-built OFX 1.x that follows the public spec. Confirm against a real statement when one shows
// up (see the spec's carry-overs).
import { InputError } from './errors.js';

function closeLeafTags(text) {
  return text.replace(/<([A-Za-z0-9.]+)>([^<\r\n]*)(\r?\n|$)/g, (whole, tag, value, nl) => {
    const trimmed = value.trim();
    return trimmed ? `<${tag}>${trimmed}</${tag}>${nl}` : whole;
  });
}

const field = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : undefined;
};
const ofxDateToIso = (d) => (d && d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : undefined);

export function parseOfx(text) {
  if (typeof text !== 'string' || !/<OFX>|<STMTTRN>/i.test(text)) {
    throw new InputError('arquivo OFX inválido: não encontrei a marca <OFX> nem nenhum <STMTTRN>');
  }
  const normalized = closeLeafTags(text);

  const transactions = [];
  const trnRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m;
  while ((m = trnRe.exec(normalized))) {
    const block = m[1];
    const date = ofxDateToIso(field(block, 'DTPOSTED'));
    const amount = Number(field(block, 'TRNAMT'));
    if (!date || !Number.isFinite(amount)) continue; // a malformed entry is skipped, not fatal
    transactions.push({
      fitid: field(block, 'FITID') || '',
      date,
      amount,
      name: field(block, 'NAME') || field(block, 'MEMO') || '',
      type: field(block, 'TRNTYPE') || '',
    });
  }

  const ledgerMatch = normalized.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i);
  const ledgerBlock = ledgerMatch ? ledgerMatch[1] : '';
  const ledgerBalanceRaw = field(ledgerBlock, 'BALAMT');
  const ledgerBalance = ledgerBalanceRaw !== undefined ? Number(ledgerBalanceRaw) : null;
  const ledgerDate = ofxDateToIso(field(ledgerBlock, 'DTASOF')) ?? null;

  if (!transactions.length && ledgerBalance === null) {
    throw new InputError('arquivo OFX sem nenhum movimento ou saldo reconhecível');
  }
  return { transactions, ledgerBalance, ledgerDate };
}
