import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators';
import type { SessionUser } from '../common/session';
import { requireOwner } from '../common/scope';
import { requireId, type Body as Json } from '../common/validation';

// Only the owner manages users and reads the activity log.
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users') list(@CurrentUser() u: SessionUser) { requireOwner(u, 'só a dona gerencia usuários'); return this.users.list(); }
  @Post('users') create(@CurrentUser() u: SessionUser, @Body() b: Json) { requireOwner(u, 'só a dona gerencia usuários'); return this.users.create(u, b); }
  @Put('users/:id') update(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() b: Json) { requireOwner(u, 'só a dona gerencia usuários'); return this.users.update(u, requireId(id), b); }
  @Delete('users/:id') remove(@CurrentUser() u: SessionUser, @Param('id') id: string) { requireOwner(u, 'só a dona gerencia usuários'); return this.users.remove(u, requireId(id)); }

  @Get('audit')
  audit(@CurrentUser() u: SessionUser, @Query('entity_id') entityId?: string, @Query('school_id') schoolId?: string) {
    requireOwner(u, 'só a dona vê a auditoria');
    return this.users.auditLog(entityId, schoolId);
  }
}
