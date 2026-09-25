import { Inject, Injectable } from '@nestjs/common';
import { calculateCharge, fingerprint, InputError, parseOfx, suggest } from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type { BankTransactionDoc, BillDoc, EntryDoc, M, SchoolDoc, TuitionDoc } from '../database/schemas';
import { AuditService } from '../common/audit.service';
import { checkAllowed } from '../common/scope';
import { requireId, type Body } from '../common/validation';
import type { SessionUser } from '../common/session';
import { BillsService } from '../bills/bills.service';
import { TuitionService } from '../tuition/tuition.service';

@Injectable()
export class BankService {
  constructor(
    @Inject(MODEL.BankTransaction) private readonly transactions: M<BankTransactionDoc>,
    @Inject(MODEL.School) private readonly schools: M<SchoolDoc>,
    @Inject(MODEL.Bill) private readonly bills: M<BillDoc>,
    @Inject(MODEL.Tuition) private readonly tuition: M<TuitionDoc>,
    @Inject(MODEL.Entry) private readonly entries: M<EntryDoc>,
    private readonly billsService: BillsService,
    private readonly tuitionService: TuitionService,
    private readonly audit: AuditService,
  ) {}

  // Imports an OFX statement: parses it, drops transactions already imported (by fingerprint), and
  // suggests a match (open bill or open tuition charge) for every new one. Nothing is paid yet —
  // suggestions are only confirmed by a human via `confirm`.
  async import(body: Body, allowedIds: string[] | null) {
    const school_id = requireId(body.school_id, 'school_id');
    checkAllowed(allowedIds, school_id);
    const { ofx } = body;
    if (typeof ofx !== 'string' || !ofx) throw new InputError('ofx (texto do arquivo) é obrigatório');
    if (!(await this.schools.exists({ _id: school_id }))) throw new InputError('escola não encontrada', 404);
    const parsed = parseOfx(ofx);
    const withFingerprint = parsed.transactions.map((t) => ({ ...t, fingerprint: fingerprint({ schoolId: school_id, date: t.date, amount: t.amount, fitid: t.fitid }) }));
    const existing = new Set((await this.transactions.find({ school_id: school_id as never, fingerprint: { $in: withFingerprint.map((t) => t.fingerprint) } }).select('fingerprint').lean()).map((t) => t.fingerprint));
    const fresh = withFingerprint.filter((t) => !existing.has(t.fingerprint));
    const summary = { ledgerBalance: parsed.ledgerBalance, ledgerDate: parsed.ledgerDate };
    if (!fresh.length) return { imported: 0, duplicates: withFingerprint.length, ...summary };
    const [bills, tuitions] = await Promise.all([
      this.bills.find({ school_id: school_id as never, paid_at: null }).select('amount due_date').lean(),
      this.tuition.find({ school_id: school_id as never, paid_at: null }).select('base_amount discount due_date').lean(),
    ]);
    const billPool = bills.map((b) => ({ id: String(b._id), amount: b.amount, due_date: b.due_date }));
    const tuitionPool = tuitions.map((t) => ({ id: String(t._id), amount: calculateCharge(t.base_amount, t.discount), due_date: t.due_date }));
    await this.transactions.insertMany(fresh.map((t) => {
      const match = suggest(t, { bills: billPool, tuitions: tuitionPool });
      return {
        school_id, fitid: t.fitid, date: t.date, amount: t.amount, name: t.name, fingerprint: t.fingerprint,
        suggested_kind: match?.kind ?? null, suggested_id: match?.id ?? null,
      };
    }) as never[], { ordered: false });
    return { imported: fresh.length, duplicates: withFingerprint.length - fresh.length, ...summary };
  }

  async list(schoolParam: string, allowedIds: string[] | null) {
    if (schoolParam !== 'all') checkAllowed(allowedIds, requireId(schoolParam, 'school'));
    const filter = schoolParam === 'all' ? (allowedIds ? { school_id: { $in: allowedIds } } : {}) : { school_id: schoolParam };
    const docs = await this.transactions.find(filter).sort({ date: -1, _id: -1 }).lean();
    return docs.map(({ _id, ...t }) => ({ ...t, id: String(_id) }));
  }

  // Confirms a transaction against a bill or tuition charge (its suggestion, or a different one the
  // human picked), paying it for real.
  async confirm(user: SessionUser, id: string, body: Body, allowedIds: string[] | null) {
    const tx = await this.transactions.findById(id);
    if (!tx) throw new InputError('transação não encontrada', 404);
    checkAllowed(allowedIds, tx.school_id);
    if (tx.reconciled) throw new InputError('esta transação já foi conciliada');
    const useKind = (body.kind as string | undefined) ?? tx.suggested_kind;
    const useId = (body.target_id as string | undefined) ?? tx.suggested_id;
    if (!useKind || !useId) throw new InputError('informe kind e target_id (ou use uma transação com sugestão)');
    if (!['bill', 'tuition'].includes(useKind)) throw new InputError('kind deve ser bill ou tuition');
    const targetId = requireId(useId, 'target_id');
    const payment = { amount_paid: Math.abs(tx.amount), paid_at: tx.date };
    const { entry_id } = useKind === 'bill'
      ? await this.billsService.pay(user, targetId, payment, allowedIds)
      : await this.tuitionService.pay(user, targetId, payment, allowedIds);
    tx.reconciled = true; tx.entry_id = entry_id as never; tx.suggested_kind = useKind as 'bill' | 'tuition'; tx.suggested_id = targetId as never;
    await tx.save();
    await this.audit.log(user, 'bank.confirm', { entity: 'bank', entity_id: tx._id, school_id: tx.school_id, after: { kind: useKind, target_id: targetId, amount: tx.amount } });
    return { ok: true, entry_id };
  }

  // Posts a plain entry for a transaction that doesn't match any open bill/tuition charge.
  async manual(user: SessionUser, id: string, body: Body, allowedIds: string[] | null) {
    const tx = await this.transactions.findById(id);
    if (!tx) throw new InputError('transação não encontrada', 404);
    checkAllowed(allowedIds, tx.school_id);
    if (tx.reconciled) throw new InputError('esta transação já foi conciliada');
    const entry = await this.entries.create({
      school_id: tx.school_id, date: tx.date, type: tx.amount < 0 ? 'expense' : 'revenue',
      category: (body.category as string) || 'Outros', description: (body.description as string) || tx.name, amount: Math.abs(tx.amount), one_off: 0,
    });
    await this.audit.log(user, 'bank.manual_entry', { entity: 'bank', entity_id: tx._id, school_id: tx.school_id, after: { category: entry.category, description: entry.description, amount: entry.amount } });
    tx.reconciled = true; tx.entry_id = entry._id;
    await tx.save();
    return { ok: true, entry_id: String(entry._id) };
  }
}
