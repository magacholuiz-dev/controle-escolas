import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { billDueDateForMonth, buildInstallments, dueSummary, generateMonthBills, InputError } from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type { BillDoc, EntryDoc, ExpenseDoc, M, SchoolDoc, SupplierDoc } from '../database/schemas';
import { AuditService } from '../common/audit.service';
import { checkAllowed } from '../common/scope';
import { isIsoDate, requireId, type Body } from '../common/validation';
import type { SessionUser } from '../common/session';

@Injectable()
export class BillsService {
  constructor(
    @Inject(MODEL.Bill) private readonly bills: M<BillDoc>,
    @Inject(MODEL.Entry) private readonly entries: M<EntryDoc>,
    @Inject(MODEL.Expense) private readonly expenses: M<ExpenseDoc>,
    @Inject(MODEL.Supplier) private readonly suppliers: M<SupplierDoc>,
    @Inject(MODEL.School) private readonly schools: M<SchoolDoc>,
    private readonly audit: AuditService,
  ) {}

  // Generates the month's bills for a school from its recurring expenses. Idempotent: expenses that
  // already have a bill for this period (unique expense_id+period index) are silently skipped.
  async generate(body: Body, allowedIds: string[] | null): Promise<{ created: number }> {
    const school_id = requireId(body.school_id, 'school_id');
    checkAllowed(allowedIds, school_id);
    const period = String(body.period ?? '');
    if (!/^\d{4}-\d{2}$/.test(period)) throw new InputError('competencia inválida (use AAAA-MM)');
    const expenses = await this.expenses.find({ school_id: school_id as never }).lean();
    const candidates = generateMonthBills(expenses, period);
    if (!candidates.length) return { created: 0 };
    const existing = new Set((await this.bills.find({ school_id: school_id as never, period }).select('expense_id').lean()).map((c) => String(c.expense_id)));
    const fresh = candidates.filter((c) => !existing.has(String(c.expense_id)));
    if (fresh.length) await this.bills.insertMany(fresh as never[], { ordered: false });
    return { created: fresh.length };
  }

  // A fixed monthly debit (rent, security, internet...): one recurring expense plus its bills from
  // `from_period` to `to_period`, all due on `due_day`. The expense also feeds the forecast.
  async createRecurring(user: SessionUser, body: Body, allowedIds: string[] | null): Promise<{ expense_id: string; created: number }> {
    const school_id = requireId(body.school_id, 'school_id');
    checkAllowed(allowedIds, school_id);
    const description = String(body.description ?? '').trim();
    if (!description) throw new InputError('descrição é obrigatória');
    const amount = Number(body.amount);
    if (!(amount > 0)) throw new InputError('o valor deve ser maior que zero');
    const dueDay = Number(body.due_day);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) throw new InputError('dia de vencimento deve ser um inteiro de 1 a 28');
    const from = String(body.from_period ?? ''), to = String(body.to_period ?? '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(to)) throw new InputError('competencia inválida (use AAAA-MM)');
    if (to < from) throw new InputError('o mês final deve ser igual ou depois do inicial');
    const periods: string[] = [];
    for (let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5))]; `${y}-${String(m).padStart(2, '0')}` <= to; m === 12 ? (y++, m = 1) : m++) periods.push(`${y}-${String(m).padStart(2, '0')}`);
    if (periods.length > 60) throw new InputError('no máximo 60 meses por recorrência');
    let supplier_id: string | null = null;
    if (body.supplier_id) {
      supplier_id = requireId(body.supplier_id, 'supplier_id');
      if (!(await this.suppliers.exists({ _id: supplier_id as never }))) throw new InputError('fornecedor não encontrado');
    }
    const category = String(body.category ?? 'Outros') || 'Outros';
    const expense = await this.expenses.create({ school_id: school_id as never, description, category, monthly_amount: amount, follows_calendar: 0, due_day: dueDay });
    const docs = await this.bills.insertMany(periods.map((period) => ({
      school_id: school_id as never, supplier_id: supplier_id as never, expense_id: expense._id, description, category, period,
      due_date: billDueDateForMonth(period, dueDay), amount,
    })) as never[], { ordered: false });
    await this.audit.log(user, 'bills.recurring_create', {
      entity: 'bills', entity_id: expense._id, school_id, after: { description, valor_mensal: amount, dia: dueDay, de: from, ate: to, contas: docs.length },
    });
    return { expense_id: String(expense._id), created: docs.length };
  }

  // Ends a recurrence: removes its unpaid bills and the recurring expense; paid bills stay as history.
  async endRecurring(user: SessionUser, expenseId: string, allowedIds: string[] | null): Promise<{ removed: number }> {
    const expense = await this.expenses.findById(expenseId);
    if (!expense) throw new InputError('não encontrado', 404);
    checkAllowed(allowedIds, expense.school_id);
    const removed = await this.bills.deleteMany({ expense_id: expense._id as never, paid_at: null });
    await this.bills.updateMany({ expense_id: expense._id as never }, { $set: { expense_id: null } });
    await expense.deleteOne();
    await this.audit.log(user, 'bills.recurring_end', { entity: 'bills', entity_id: expense._id, school_id: expense.school_id, before: { description: expense.description, contas_removidas: removed.deletedCount } });
    return { removed: removed.deletedCount };
  }

  // An installment purchase ("R$ 2.000 in 3x" or "10x of R$ 340"): one bill per installment, monthly,
  // all sharing `installment_group_id` so the screen can show "2/3" and remove the unpaid ones together.
  async createInstallments(user: SessionUser, body: Body, allowedIds: string[] | null) {
    const { supplier_id, description, category, first_due_date, count, total_amount, installment_amount } = body;
    const school_id = requireId(body.school_id, 'school_id');
    checkAllowed(allowedIds, school_id);
    if (!String(description || '').trim()) throw new InputError('descrição é obrigatória');
    if (supplier_id) {
      requireId(supplier_id, 'supplier_id');
      if (!(await this.suppliers.exists({ _id: supplier_id as string }))) throw new InputError('fornecedor não encontrado');
    }
    const { total, installments } = buildInstallments({
      total: total_amount, installmentAmount: installment_amount, count, firstDueDate: first_due_date as string | undefined,
    });
    const installment_group_id = randomUUID();
    const text = String(description).trim();
    const docs = await this.bills.insertMany(installments.map((p) => ({
      school_id, supplier_id: supplier_id || null, description: text, category: (category as string) || 'Outros',
      period: p.period, due_date: p.due_date, amount: p.amount,
      installment_group_id, installment_no: p.number, installment_count: p.count,
    })) as never[]);
    await this.audit.log(user, 'bills.installments', {
      entity: 'bills', entity_id: docs[0]?._id, school_id, after: { description: text, parcelas: installments.length, total, primeira: installments[0]?.amount },
    });
    return { installment_group_id, count: installments.length, total, ids: docs.map((d) => String(d._id)) };
  }

  async pay(user: SessionUser, id: string, body: Body, allowedIds: string[] | null): Promise<{ ok: true; entry_id: string }> {
    const bill = await this.bills.findById(id);
    if (!bill) throw new InputError('conta não encontrada', 404);
    checkAllowed(allowedIds, bill.school_id);
    if (bill.paid_at) throw new InputError('esta conta já está paga');
    const amount = Number(body.amount_paid ?? bill.amount);
    if (!(amount > 0)) throw new InputError('valor pago deve ser maior que zero');
    const date = (body.paid_at as string | undefined) || new Date().toISOString().slice(0, 10);
    if (!isIsoDate(date)) throw new InputError('paid_at inválido (use AAAA-MM-DD)');
    const entry = await this.entries.create({
      school_id: bill.school_id, date, type: 'expense', category: bill.category, one_off: 0,
      description: bill.description, amount, bill_id: bill._id,
    });
    bill.paid_at = date; bill.amount_paid = amount; bill.payment_method = (body.payment_method as string) || '';
    await bill.save();
    await this.audit.log(user, 'bill.pay', { entity: 'bills', entity_id: bill._id, school_id: bill.school_id, after: { description: bill.description, amount_paid: amount, paid_at: date } });
    return { ok: true, entry_id: String(entry._id) };
  }

  async undo(user: SessionUser, id: string, allowedIds: string[] | null): Promise<{ ok: true }> {
    const bill = await this.bills.findById(id);
    if (!bill) throw new InputError('conta não encontrada', 404);
    checkAllowed(allowedIds, bill.school_id);
    if (!bill.paid_at) throw new InputError('esta conta não está paga');
    await this.entries.deleteOne({ bill_id: bill._id });
    const before = { description: bill.description, amount_paid: bill.amount_paid, paid_at: bill.paid_at };
    bill.paid_at = null; bill.amount_paid = null; bill.payment_method = '';
    await bill.save();
    await this.audit.log(user, 'bill.undo_pay', { entity: 'bills', entity_id: bill._id, school_id: bill.school_id, before });
    return { ok: true };
  }

  async panel(schoolParam: string, days: number, allowedIds: string[] | null) {
    if (schoolParam !== 'all') checkAllowed(allowedIds, requireId(schoolParam, 'school'));
    const filter = schoolParam === 'all' ? (allowedIds ? { school_id: { $in: allowedIds } } : {}) : { school_id: schoolParam };
    const [bills, schools] = await Promise.all([this.bills.find(filter).lean(), this.schools.find().select('name').lean()]);
    const names = new Map(schools.map((e) => [String(e._id), e.name]));
    const today = new Date().toISOString().slice(0, 10);
    const r = dueSummary(bills, today, days);
    const withSchoolName = (b: (typeof bills)[number]) => ({ ...b, id: String(b._id), school: names.get(String(b.school_id)) });
    return { today, totalOverdue: r.totalOverdue, totalUpcoming: r.totalUpcoming, overdue: r.overdue.map(withSchoolName), upcoming: r.upcoming.map(withSchoolName) };
  }
}
