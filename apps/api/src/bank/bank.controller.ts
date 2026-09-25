import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { BankService } from './bank.service';
import { CurrentUser, Scope } from '../common/decorators';
import type { SessionUser } from '../common/session';
import { requireId, type Body as Json } from '../common/validation';

@Controller('bank')
export class BankController {
  constructor(private readonly bank: BankService) {}

  @Post('import') import(@Body() b: Json, @Scope() a: string[] | null) { return this.bank.import(b, a); }
  @Get('list') list(@Query('school') s: string | undefined, @Scope() a: string[] | null) { return this.bank.list(s || 'all', a); }
  @Post(':id/confirm') @HttpCode(200) confirm(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() b: Json, @Scope() a: string[] | null) { return this.bank.confirm(u, requireId(id), b, a); }
  @Post(':id/manual') @HttpCode(200) manual(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() b: Json, @Scope() a: string[] | null) { return this.bank.manual(u, requireId(id), b, a); }
}
