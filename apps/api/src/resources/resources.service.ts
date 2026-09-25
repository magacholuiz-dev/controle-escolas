import { Inject, Injectable } from '@nestjs/common';
import { InputError, validateChild } from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type {
  BillDoc, ChildDoc, EmployeeDoc, EntryDoc, ExpenseDoc, M, RevenueDoc, ScenarioDoc, SchoolDoc, SupplierDoc, TuitionDoc,
} from '../database/schemas';
import { AuditService } from '../common/audit.service';
import { requireId, type Body } from '../common/validation';
import { type AnyModel, Resource, type ResourceConfig } from './resource';

const asAny = <T>(m: M<T>): AnyModel => m as unknown as AnyModel;

@Injectable()
export class ResourcesService {
  private readonly resources: Map<string, Resource>;

  constructor(
    @Inject(MODEL.Employee) employees: M<EmployeeDoc>, @Inject(MODEL.Revenue) revenues: M<RevenueDoc>,
    @Inject(MODEL.Expense) expenses: M<ExpenseDoc>, @Inject(MODEL.Entry) entries: M<EntryDoc>,
    @Inject(MODEL.School) schools: M<SchoolDoc>, @Inject(MODEL.Child) children: M<ChildDoc>,
    @Inject(MODEL.Tuition) tuition: M<TuitionDoc>, @Inject(MODEL.Supplier) suppliers: M<SupplierDoc>,
    @Inject(MODEL.Scenario) scenarios: M<ScenarioDoc>, @Inject(MODEL.Bill) bills: M<BillDoc>,
    audit: AuditService,
  ) {
    const configs: ResourceConfig[] = [
      { name: 'employees', model: asAny(employees), scoped: true, cols: ['school_id', 'name', 'role', 'cpf', 'salary', 'benefits', 'hire_date', 'termination_date', 'vacation_periods_taken', 'fgts_balance', 'vacation_month', 'active'] },
      { name: 'revenues', model: asAny(revenues), scoped: true, cols: ['school_id', 'description', 'monthly_amount', 'follows_calendar'] },
      { name: 'expenses', model: asAny(expenses), scoped: true, cols: ['school_id', 'description', 'category', 'monthly_amount', 'follows_calendar', 'due_day'] },
      { name: 'entries', model: asAny(entries), scoped: true, cols: ['school_id', 'date', 'type', 'category', 'description', 'amount', 'one_off'] },
      { name: 'schools', model: asAny(schools), scoped: false, cols: ['name', 'payroll_tax_pct', 'tax_pct', 'initial_balance', 'vacation_month', 'children_count', 'capacity', 'child_daily_rate', 'tuition_due_day', 'turnover_pct'] },
      {
        name: 'children', model: asAny(children), scoped: true,
        cols: ['school_id', 'name', 'birth_date', 'classroom', 'guardian_name', 'guardian_phone', 'enrollment_type', 'tuition_amount', 'enrollment_date', 'exit_date'],
        validate: async (data: Body, existing) => validateChild({
          enrollment_date: (('enrollment_date' in data ? data.enrollment_date : existing?.enrollment_date) as string | null | undefined),
          exit_date: (('exit_date' in data ? data.exit_date : existing?.exit_date) as string | null | undefined),
        }),
      },
      {
        name: 'tuition', model: asAny(tuition), scoped: true, hasDueDate: true,
        cols: ['school_id', 'child_id', 'period', 'base_amount', 'discount', 'due_date'],
        validate: async (data: Body) => {
          if (data.child_id) {
            requireId(data.child_id, 'child_id');
            if (!(await children.exists({ _id: data.child_id as string }))) throw new InputError('criança não encontrada');
          }
        },
      },
      { name: 'suppliers', model: asAny(suppliers), scoped: false, cols: ['name', 'tax_id', 'contact'] },
      { name: 'scenarios', model: asAny(scenarios), scoped: true, cols: ['school_id', 'name', 'adjustments'] },
      {
        name: 'bills', model: asAny(bills), scoped: true, hasDueDate: true,
        cols: ['school_id', 'supplier_id', 'description', 'category', 'period', 'due_date', 'amount'],
        validate: async (data: Body) => {
          if (data.supplier_id) {
            requireId(data.supplier_id, 'supplier_id');
            if (!(await suppliers.exists({ _id: data.supplier_id as string }))) throw new InputError('fornecedor não encontrado');
          }
        },
      },
    ];
    this.resources = new Map(configs.map((c) => [c.name, new Resource(c, audit)]));
  }

  get(name: string): Resource {
    const r = this.resources.get(name);
    if (!r) throw new InputError('recurso não encontrado', 404);
    return r;
  }
}
