import { Module } from '@nestjs/common';
import { CalendarController, SchoolsController } from './schools.controller';
import { CalendarService } from './calendar.service';

@Module({ controllers: [SchoolsController, CalendarController], providers: [CalendarService], exports: [CalendarService] })
export class SchoolsModule {}
