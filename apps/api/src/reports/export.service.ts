import { Inject, Injectable } from '@nestjs/common';
import {
  BILLS_COLUMNS, ENTRIES_COLUMNS, entriesRows, InputError, PAYROLL_COLUMNS, paidBillsRows, payrollRows, STATEMENT_COLUMNS, statementRows, toCsv,
  buildStatement,
} from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type { BillDoc, EmployeeDoc, EntryDoc, M } from '../database/schemas';
import { ReportsService } from './reports.service';
import { checkAllowed } from '../common/scope';
import { requireId, requirePeriod } from '../common/validation';

export interface CsvFile { filename: string; content: string }

@Injectable()
export class ExportService {
  constructor(
    @Inject(MODEL.Employee) private readonly employees: M<EmployeeDoc>,
    @Inject(MODEL.Bill) private readonly bills: M<BillDoc>,
    @Inject(MODEL.Entry) private readonly entries: M<EntryDoc>,
    private readonly reports: ReportsService,
  ) {}

  async build(kind: string, q: Record<string, unknown>, allowedIds: string[] | null): Promise<CsvFile> {
    const schoolId = requireId(q.school_id, 'school_id');
    checkAllowed(allowedIds, schoolId);

    if (kind === 'payroll') {
      const period = requirePeriod(q.period);
      const employees = await this.employees.find({ school_id: schoolId as never }).lean();
      return { filename: `folha-${period}.csv`, content: toCsv(payrollRows(employees, period), PAYROLL_COLUMNS) };
    }
    if (kind === 'statement') {
      const year = this.reports.parseYear(q.year);
      const report = await this.reports.buildReport(year, schoolId);
      return { filename: `dre-${year}.csv`, content: toCsv(statementRows(buildStatement(report)), STATEMENT_COLUMNS) };
    }
    if (kind === 'bills') {
      const period = q.period ? requirePeriod(q.period) : null;
      const bills = await this.bills.find({ school_id: schoolId as never }).lean();
      return { filename: `contas-pagas${period ? `-${period}` : ''}.csv`, content: toCsv(paidBillsRows(bills, period), BILLS_COLUMNS) };
    }
    if (kind === 'entries') {
      const year = this.reports.parseYear(q.year);
      const entries = await this.entries.find({ school_id: schoolId as never, date: { $regex: `^${year}-` } }).sort({ date: -1, _id: -1 }).lean();
      return { filename: `lancamentos-${year}.csv`, content: toCsv(entriesRows(entries), ENTRIES_COLUMNS) };
    }
    throw new InputError('exportação não encontrada', 404);
  }
}
