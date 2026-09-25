import { Module } from '@nestjs/common';
import { TuitionController } from './tuition.controller';
import { TuitionService } from './tuition.service';

@Module({ controllers: [TuitionController], providers: [TuitionService], exports: [TuitionService] })
export class TuitionModule {}
