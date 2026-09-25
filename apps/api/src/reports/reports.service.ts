import { Inject, Injectable } from '@nestjs/common';
import {
  buildMetrics, betterSchool, buildStatement, calculateSchool, consolidate, generateAlerts, InputError, isActiveOn,
  type Alert, type Metrics, type Report, type SchoolInputs, type Statement,
} from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type {
  BillDoc, CalendarDoc, ChildDoc, EmployeeDoc, EntryDoc, ExpenseDoc, M, RevenueDoc, SchoolDoc,
} from '../database/schemas';
import { CalendarService } from '../schools/calendar.service';
import { checkAllowed } from '../common/scope';
import { requireId, requireYear } from '../common/validation';

type SchoolLean = SchoolDoc & { _id: unknown };

export type FullReport = Report & { bySchool?: { id: string; name: string; [k: string]: unknown }[] };

@Injectable()
export class ReportsService {
  constructor(
    @Inject(MODEL.School) private readonly schools: M<SchoolDoc>,
    @Inject(MODEL.Employee) private readonly employees: M<EmployeeDoc>,
    @Inject(MODEL.Revenue) private readonly revenues: M<RevenueDoc>,
    @Inject(MODEL.Expense) private readonly expenses: M<ExpenseDoc>,
    @Inject(MODEL.Calendar) private readonly calendar: M<CalendarDoc>,
    @Inject(MODEL.Entry) private readonly entries: M<EntryDoc>,
    @Inject(MODEL.Child) private readonly children: M<ChildDoc>,
    @Inject(MODEL.Bill) private readonly bills: M<BillDoc>,
    private readonly calendars: CalendarService,
  ) {}

  // Loads the exact plain-object inputs `calculateSchool` expects, for one school. Shared by the
  // report and the scenario simulator, so both always compute from the same real data.
  async loadSchoolInputs(school: SchoolLean, year: number): Promise<SchoolInputs> {
    await this.calendars.ensure(school._id, year);
    const schoolId = school._id as never;
    const [employees, revenues, expenses, cal, entries, children] = await Promise.all([
      this.employees.find({ school_id: schoolId }).lean(),
      this.revenues.find({ school_id: schoolId }).lean(),
      this.expenses.find({ school_id: schoolId }).lean(),
      this.calendar.find({ school_id: schoolId, year }).sort('month').lean(),
      this.entries.find({ school_id: schoolId, date: { $regex: `^${year}-` } }).lean(),
      this.children.find({ school_id: schoolId }).lean(),
    ]);
    return {
      school, employees, revenues, expenses, factors: cal.map((c) => c.factor), closedMonths: cal.map((c) => c.closed),
      entries, year, children, schoolDays: cal.map((c) => c.school_days),
      severanceReserve: school.turnover_pct > 0 ? { turnoverPct: school.turnover_pct } : null,
    };
  }

  async buildReport(year: number, schoolParam: string, allowedIds: string[] | null = null): Promise<FullReport> {
    if (schoolParam !== 'all') { requireId(schoolParam, 'school'); checkAllowed(allowedIds, schoolParam); }
    const filter = schoolParam === 'all' ? (allowedIds ? { _id: { $in: allowedIds } } : {}) : { _id: schoolParam };
    const schools = await this.schools.find(filter).sort('_id').lean();
    const results = await Promise.all(schools.map(async (school) => calculateSchool(await this.loadSchoolInputs(school, year))));
    if (schoolParam !== 'all') {
      const one = results[0];
      if (!one) throw new InputError('escola não encontrada', 404);
      return one;
    }
    return {
      ...consolidate(results, schools.reduce((s, e) => s + e.initial_balance, 0)),
      bySchool: schools.map((e, i) => ({ id: String(e._id), name: e.name, ...(results[i] as Report).totals })),
    };
  }

  async statement(year: number, schoolParam: string, allowedIds: string[] | null): Promise<Statement> {
    return buildStatement(await this.buildReport(year, schoolParam, allowedIds));
  }

  private async activeChildren(schoolId: unknown, today: string): Promise<number> {
    const kids = await this.children.find({ school_id: schoolId as never }).select('enrollment_date exit_date').lean();
    return kids.filter((c) => isActiveOn(c, today)).length;
  }

  async metrics(year: number, schoolParam: string, allowedIds: string[] | null) {
    const today = new Date().toISOString().slice(0, 10);
    if (schoolParam !== 'all') {
      requireId(schoolParam, 'school');
      checkAllowed(allowedIds, schoolParam);
      const [report, activeChildren] = await Promise.all([this.buildReport(year, schoolParam), this.activeChildren(schoolParam, today)]);
      return buildMetrics({ report, activeChildren });
    }
    const schools = await this.schools.find(allowedIds ? { _id: { $in: allowedIds } } : {}).sort('_id').lean();
    const perSchool = await Promise.all(schools.map(async (s) => {
      const [report, activeChildren] = await Promise.all([this.buildReport(year, String(s._id)), this.activeChildren(s._id, today)]);
      return { id: String(s._id), name: s.name, ...buildMetrics({ report, activeChildren }) };
    }));
    const consolidatedReport = await this.buildReport(year, 'all', allowedIds);
    const totalActiveChildren = perSchool.reduce((s, x) => s + x.activeChildren, 0);
    const consolidated = buildMetrics({ report: consolidatedReport, activeChildren: totalActiveChildren });
    const rows = { costPerChild: 'lower', revenuePerChild: 'higher', payrollOverRevenue: 'lower', breakEven: 'lower', margin: 'higher' } as const;
    const winners: Record<string, string | null> = {};
    for (const key of Object.keys(rows) as (keyof typeof rows)[]) {
      winners[key] = betterSchool(perSchool.map((s: { id: string } & Metrics) => ({ id: s.id, value: s[key] })), rows[key]);
    }
    return { schools: perSchool, consolidated, winners };
  }

  async alerts(year: number, schoolIdParam: string, allowedIds: string[] | null): Promise<Alert[]> {
    const schoolId = requireId(schoolIdParam, 'school_id');
    checkAllowed(allowedIds, schoolId);
    const today = new Date().toISOString().slice(0, 10);
    const [report, employees, bills] = await Promise.all([
      this.buildReport(year, schoolId),
      this.employees.find({ school_id: schoolId as never }).lean(),
      this.bills.find({ school_id: schoolId as never }).lean(),
    ]);
    const currentMonth = Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) : 0;
    return generateAlerts({ employees, bills, months: report.months, today, currentMonth });
  }

  parseYear(v: unknown): number { return requireYear(v ?? new Date().getFullYear()); }
}
