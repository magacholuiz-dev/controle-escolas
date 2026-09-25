import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { Scope } from '../common/decorators';

type Query_ = Record<string, unknown>;
const schoolOf = (q: Query_): string => (q.school ? String(q.school) : 'all');

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService, private readonly exporter: ExportService) {}

  @Get('report') report(@Query() q: Query_, @Scope() allowed: string[] | null) { return this.reports.buildReport(this.reports.parseYear(q.year), schoolOf(q), allowed); }
  @Get('statement') statement(@Query() q: Query_, @Scope() allowed: string[] | null) { return this.reports.statement(this.reports.parseYear(q.year), schoolOf(q), allowed); }
  @Get('metrics') metrics(@Query() q: Query_, @Scope() allowed: string[] | null) { return this.reports.metrics(this.reports.parseYear(q.year), schoolOf(q), allowed); }
  @Get('alerts') alerts(@Query() q: Query_, @Scope() allowed: string[] | null) { return this.reports.alerts(this.reports.parseYear(q.year), String(q.school_id ?? ''), allowed); }

  @Get('export/:kind')
  async export(@Param('kind') kind: string, @Query() q: Query_, @Scope() allowed: string[] | null, @Res() res: Response): Promise<void> {
    const { filename, content } = await this.exporter.build(kind, q, allowed);
    res.status(200).set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` }).end(content);
  }
}
