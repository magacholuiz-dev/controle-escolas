import { Inject, Injectable } from '@nestjs/common';
import { calculateCharge, chargeMessage, delinquency, generateMonthTuition, InputError, overdueBracket } from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type { ChildDoc, EntryDoc, M, SchoolDoc, TuitionDoc } from '../database/schemas';
import { AuditService } from '../common/audit.service';
import { checkAllowed } from '../common/scope';
import { isIsoDate, requireId, type Body } from '../common/validation';
import type { SessionUser } from '../common/session';

@Injectable()
export class TuitionService {
  constructor(
    @Inject(MODEL.Tuition) private readonly tuition: M<TuitionDoc>,
    @Inject(MODEL.Entry) private readonly entries: M<EntryDoc>,
    @Inject(MODEL.Child) private readonly children: M<ChildDoc>,
    @Inject(MODEL.School) private readonly schools: M<SchoolDoc>,
    private readonly audit: AuditService,
  ) {}

  // Generates the month's tuition charges for a school, from its privately-funded children.
  // Idempotent: charges that already exist (unique child_id+period index) are skipped.
  async generate(body: Body, allowedIds: string[] | null): Promise<{ created: number }> {
    const school_id = requireId(body.school_id, 'school_id');
    checkAllowed(allowedIds, school_id);
    const period = String(body.period ?? '');
    if (!/^\d{4}-\d{2}$/.test(period)) throw new InputError('competencia inválida (use AAAA-MM)');
    const school = await this.schools.findById(school_id).select('tuition_due_day').lean();
    if (!school) throw new InputError('escola não encontrada', 404);
    const children = await this.children.find({ school_id: school_id as never }).lean();
    const candidates = generateMonthTuition(children, period, school.tuition_due_day || 10);
    if (!candidates.length) return { created: 0 };
    const existing = new Set((await this.tuition.find({ school_id: school_id as never, period }).select('child_id').lean()).map((t) => String(t.child_id)));
    const fresh = candidates.filter((t) => !existing.has(String(t.child_id)));
    if (fresh.length) await this.tuition.insertMany(fresh as never[], { ordered: false });
    return { created: fresh.length };
  }

  async pay(user: SessionUser, id: string, body: Body, allowedIds: string[] | null): Promise<{ ok: true; entry_id: string }> {
    const charge = await this.tuition.findById(id);
    if (!charge) throw new InputError('mensalidade não encontrada', 404);
    checkAllowed(allowedIds, charge.school_id);
    if (charge.paid_at) throw new InputError('esta mensalidade já está paga');
    const amount = Number(body.amount_paid ?? calculateCharge(charge.base_amount, charge.discount));
    if (!(amount > 0)) throw new InputError('valor pago deve ser maior que zero');
    const date = (body.paid_at as string | undefined) || new Date().toISOString().slice(0, 10);
    if (!isIsoDate(date)) throw new InputError('paid_at inválido (use AAAA-MM-DD)');
    const entry = await this.entries.create({
      school_id: charge.school_id, date, type: 'revenue', category: 'Mensalidades', one_off: 0,
      description: `Mensalidade ${charge.period}`, amount, tuition_id: charge._id,
    });
    charge.paid_at = date; charge.amount_paid = amount; charge.payment_method = (body.payment_method as string) || '';
    await charge.save();
    await this.audit.log(user, 'tuition.pay', { entity: 'tuition', entity_id: charge._id, school_id: charge.school_id, after: { period: charge.period, amount_paid: amount, paid_at: date } });
    return { ok: true, entry_id: String(entry._id) };
  }

  async undo(user: SessionUser, id: string, allowedIds: string[] | null): Promise<{ ok: true }> {
    const charge = await this.tuition.findById(id);
    if (!charge) throw new InputError('mensalidade não encontrada', 404);
    checkAllowed(allowedIds, charge.school_id);
    if (!charge.paid_at) throw new InputError('esta mensalidade não está paga');
    await this.entries.deleteOne({ tuition_id: charge._id });
    const before = { period: charge.period, amount_paid: charge.amount_paid, paid_at: charge.paid_at };
    charge.paid_at = null; charge.amount_paid = null; charge.payment_method = '';
    await charge.save();
    await this.audit.log(user, 'tuition.undo_pay', { entity: 'tuition', entity_id: charge._id, school_id: charge.school_id, before });
    return { ok: true };
  }

  async panel(schoolParam: string, allowedIds: string[] | null) {
    if (schoolParam !== 'all') checkAllowed(allowedIds, requireId(schoolParam, 'school'));
    const filter = schoolParam === 'all' ? (allowedIds ? { school_id: { $in: allowedIds } } : {}) : { school_id: schoolParam };
    const [charges, schools, children] = await Promise.all([
      this.tuition.find(filter).lean(),
      this.schools.find().select('name').lean(),
      this.children.find().select('name guardian_name guardian_phone').lean(),
    ]);
    const schoolNames = new Map(schools.map((e) => [String(e._id), e.name]));
    const childrenById = new Map(children.map((c) => [String(c._id), c]));
    const today = new Date().toISOString().slice(0, 10);
    const info = delinquency(charges, today);
    const debtors = charges
      .filter((t) => !t.paid_at && t.due_date < today)
      .map((t) => {
        const child = childrenById.get(String(t.child_id)) ?? { name: '(criança removida)', guardian_name: undefined };
        const school = schoolNames.get(String(t.school_id));
        return {
          id: String(t._id), child: child.name, school,
          period: t.period, due_date: t.due_date, amount: calculateCharge(t.base_amount, t.discount),
          bracket: overdueBracket(t.due_date, today, false),
          message: chargeMessage(t, child, school || ''),
        };
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    return { today, totalDue: info.totalDue, totalOverdue: info.totalOverdue, delinquencyPct: info.pct, debtors };
  }
}
