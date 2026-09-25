import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { CrudController } from '../resources/crud.controller';
import { ResourcesService } from '../resources/resources.service';
import { CalendarService } from './calendar.service';
import { Scope } from '../common/decorators';
import type { Body as Json } from '../common/validation';

@Controller('schools')
export class SchoolsController extends CrudController {
  protected readonly resource = 'schools';
  constructor(resources: ResourcesService) { super(resources); }
}

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get() get(@Query('school_id') s: string, @Query('year') y: string, @Scope() allowed: string[] | null) { return this.calendar.get(s, y, allowed); }
  @Put() put(@Query('school_id') s: string, @Query('year') y: string, @Scope() allowed: string[] | null, @Body() b: Json) { return this.calendar.put(s, y, allowed, b); }
}
