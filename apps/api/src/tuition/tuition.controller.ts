import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CrudController } from '../resources/crud.controller';
import { ResourcesService } from '../resources/resources.service';
import { TuitionService } from './tuition.service';
import { CurrentUser, Scope } from '../common/decorators';
import type { SessionUser } from '../common/session';
import { requireId, type Body as Json } from '../common/validation';

@Controller('tuition')
export class TuitionController extends CrudController {
  protected readonly resource = 'tuition';
  constructor(resources: ResourcesService, private readonly tuition: TuitionService) { super(resources); }

  @Post('generate') generate(@Body() b: Json, @Scope() a: string[] | null) { return this.tuition.generate(b, a); }
  @Get('panel') panel(@Query('school') s: string | undefined, @Scope() a: string[] | null) { return this.tuition.panel(s || 'all', a); }
  @Post(':id/pay') @HttpCode(200) pay(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() b: Json, @Scope() a: string[] | null) { return this.tuition.pay(u, requireId(id), b, a); }
  @Post(':id/undo') @HttpCode(200) undo(@CurrentUser() u: SessionUser, @Param('id') id: string, @Scope() a: string[] | null) { return this.tuition.undo(u, requireId(id), a); }
}
