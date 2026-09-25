import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CrudController } from '../resources/crud.controller';
import { ResourcesService } from '../resources/resources.service';
import { BillsService } from './bills.service';
import { CurrentUser, Scope } from '../common/decorators';
import type { SessionUser } from '../common/session';
import { requireId, type Body as Json } from '../common/validation';

@Controller('bills')
export class BillsController extends CrudController {
  protected readonly resource = 'bills';
  constructor(resources: ResourcesService, private readonly bills: BillsService) { super(resources); }

  @Post('generate') generate(@Body() b: Json, @Scope() a: string[] | null) { return this.bills.generate(b, a); }
  @Post('installments') installments(@CurrentUser() u: SessionUser, @Body() b: Json, @Scope() a: string[] | null) { return this.bills.createInstallments(u, b, a); }
  @Post('recurring') recurring(@CurrentUser() u: SessionUser, @Body() b: Json, @Scope() a: string[] | null) { return this.bills.createRecurring(u, b, a); }
  @Delete('recurring/:expenseId') endRecurring(@CurrentUser() u: SessionUser, @Param('expenseId') id: string, @Scope() a: string[] | null) { return this.bills.endRecurring(u, requireId(id), a); }
  @Get('panel') panel(@Query('school') s: string | undefined, @Query('days') d: string | undefined, @Scope() a: string[] | null) { return this.bills.panel(s || 'all', Number(d) || 7, a); }
  @Post(':id/pay') @HttpCode(200) pay(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() b: Json, @Scope() a: string[] | null) { return this.bills.pay(u, requireId(id), b, a); }
  @Post(':id/undo') @HttpCode(200) undo(@CurrentUser() u: SessionUser, @Param('id') id: string, @Scope() a: string[] | null) { return this.bills.undo(u, requireId(id), a); }
}
