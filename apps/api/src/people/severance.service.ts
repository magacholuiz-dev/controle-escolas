import { Inject, Injectable } from '@nestjs/common';
import { calculateSeverance, InputError, SEVERANCE_TYPES, type SeveranceType } from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type { EmployeeDoc, EntryDoc, M } from '../database/schemas';
import { AuditService } from '../common/audit.service';
import { checkAllowed } from '../common/scope';
import { requireId } from '../common/validation';
import type { SessionUser } from '../common/session';

type Params = Record<string, unknown>;

// GET passes a query string and POST a JSON body; both are read the same way (as strings, exactly
// like the legacy URLSearchParams did).
const asParams = (p: Params): URLSearchParams => new URLSearchParams(Object.entries(p).map(([k, v]): [string, string] => [k, String(v)]));

@Injectable()
export class SeveranceService {
  constructor(
    @Inject(MODEL.Employee) private readonly employees: M<EmployeeDoc>,
    @Inject(MODEL.Entry) private readonly entries: M<EntryDoc>,
    private readonly audit: AuditService,
  ) {}

  private async input(params: Params, allowedIds: string[] | null) {
    const q = asParams(params);
    const employee = await this.employees.findById(requireId(q.get('employee_id'), 'employee_id')).lean();
    if (!employee) throw new InputError('colaborador não encontrado', 404);
    checkAllowed(allowedIds, employee.school_id);
    if (!employee.hire_date) throw new InputError('cadastre a data de admissão do colaborador');
    return {
      employee,
      input: {
        salary: employee.salary, hire_date: employee.hire_date, termination_date: q.get('date') as string, type: q.get('type') as string,
        notice: q.get('notice') || 'paid_in_lieu', notice_worked: q.get('notice_worked') !== '0',
        vacation_periods_taken: employee.vacation_periods_taken || 0, fgts_balance: employee.fgts_balance,
      },
    };
  }

  async simulate(params: Params, allowedIds: string[] | null) {
    const { employee, input } = await this.input(params, allowedIds);
    return { employee: { id: String(employee._id), name: employee.name }, ...calculateSeverance(input) };
  }

  // Terminates the employee and posts the severance cost as a one-off expense in the month.
  async apply(user: SessionUser, params: Params, allowedIds: string[] | null) {
    const { employee, input } = await this.input(params, allowedIds);
    const result = calculateSeverance(input);
    await this.employees.updateOne({ _id: employee._id }, { $set: { active: 0, termination_date: input.termination_date } });
    await this.entries.create({
      school_id: employee.school_id, date: input.termination_date, type: 'expense', category: 'Rescisão', one_off: 1,
      description: `${SEVERANCE_TYPES[input.type as SeveranceType]} — ${employee.name}`, amount: result.schoolCost,
    });
    await this.audit.log(user, 'severance.apply', {
      entity: 'Employee', entity_id: employee._id, school_id: employee.school_id,
      before: { active: true }, after: { active: false, type: input.type, schoolCost: result.schoolCost },
    });
    return { ok: true, schoolCost: result.schoolCost };
  }
}
