import { Module } from '@nestjs/common';
import { ScenariosController } from './scenarios.controller';
import { ReportsModule } from '../reports/reports.module';

@Module({ imports: [ReportsModule], controllers: [ScenariosController] })
export class ScenariosModule {}
