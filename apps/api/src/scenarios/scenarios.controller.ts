import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { applyAdjustments, calculateSchool, InputError, type Adjustment, type Report } from '@controle-escolas/domain';
import { CrudController } from '../resources/crud.controller';
import { ResourcesService } from '../resources/resources.service';
import { ReportsService } from '../reports/reports.service';
import { Scope } from '../common/decorators';
import { checkAllowed } from '../common/scope';
import { requireId, requireYear, type Body as Json } from '../common/validation';
import { MODEL } from '../database/models';
import type { M, SchoolDoc } from '../database/schemas';

const summarize = (report: Report) => ({
  result: report.totals.result, revenue: report.totals.revenue,
  minBalance: report.minBalance, minBalanceMonth: report.minBalanceMonth,
  finalBalance: report.finalBalance, reserveNeeded: report.reserveNeeded,
});

@Controller('scenarios')
export class ScenariosController extends CrudController {
  protected readonly resource = 'scenarios';
  constructor(resources: ResourcesService, private readonly reports: ReportsService, @Inject(MODEL.School) private readonly schools: M<SchoolDoc>) { super(resources); }

  // Simulates without ever writing: the same calculation as the real report, on adjusted copies.
  @Post('simulate') @HttpCode(200)
  async simulate(@Body() body: Json, @Scope() allowed: string[] | null) {
    if (body.school_id) checkAllowed(allowed, requireId(body.school_id, 'school_id'));
    const school_id = requireId(body.school_id, 'school_id');
    const year = requireYear(body.year ?? new Date().getFullYear());
    if (body.adjustments !== undefined && !Array.isArray(body.adjustments)) throw new InputError('adjustments deve ser uma lista');
    const school = await this.schools.findById(school_id).lean();
    if (!school) throw new InputError('escola não encontrada', 404);
    const inputs = await this.reports.loadSchoolInputs(school, year);
    const base = calculateSchool(inputs);
    const applied = applyAdjustments(inputs, (body.adjustments as Adjustment[] | undefined) || []);
    const scenario = calculateSchool({ ...inputs, ...applied });
    return { base: summarize(base), scenario: summarize(scenario), warnings: applied.warnings };
  }
}
