import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CurrentUser, Scope } from '../common/decorators';
import type { SessionUser } from '../common/session';
import { requireId, type Body as Json } from '../common/validation';

type Query_ = Record<string, unknown>;

// Base for the ten resources with a plain CRUD. Each subclass only declares its @Controller path and
// resource name, so a route table can be enumerated and checked (every one sits behind the session
// guard and is school-scoped in Resource).
export abstract class CrudController {
  protected abstract readonly resource: string;
  constructor(protected readonly resources: ResourcesService) {}

  @Get() list(@Query() q: Query_, @Scope() allowed: string[] | null) { return this.resources.get(this.resource).list(q, allowed); }
  @Post() create(@CurrentUser() u: SessionUser, @Scope() allowed: string[] | null, @Body() body: Json) { return this.resources.get(this.resource).create(u, allowed, body); }
  @Put(':id') update(@CurrentUser() u: SessionUser, @Scope() allowed: string[] | null, @Param('id') id: string, @Body() body: Json) { return this.resources.get(this.resource).update(u, allowed, requireId(id), body); }
  @Delete(':id') remove(@CurrentUser() u: SessionUser, @Scope() allowed: string[] | null, @Param('id') id: string, @Query() q: Query_) { return this.resources.get(this.resource).remove(u, allowed, requireId(id), q); }
}
