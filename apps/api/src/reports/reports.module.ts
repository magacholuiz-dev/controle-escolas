import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { SchoolsModule } from '../schools/schools.module';

@Module({ imports: [SchoolsModule], controllers: [ReportsController], providers: [ReportsService, ExportService], exports: [ReportsService] })
export class ReportsModule {}
