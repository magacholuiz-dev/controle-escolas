import { randomUUID } from 'node:crypto';
import { Body, Controller, Post } from '@nestjs/common';
import { InputError, prorate } from '@controle-escolas/domain';
import { Inject } from '@nestjs/common';
import { CrudController } from '../resources/crud.controller';
import { ResourcesService } from '../resources/resources.service';
import { AuditService, docSummary } from '../common/audit.service';
import { CurrentUser } from '../common/decorators';
import { requireOwner } from '../common/scope';
import { pickFields, type Body as Json } from '../common/validation';
import type { SessionUser } from '../common/session';
import { MODEL } from '../database/models';
import type { M, SchoolDoc } from '../database/schemas';

@Controller('revenues') export class RevenuesController extends CrudController { protected readonly resource = 'revenues'; constructor(r: ResourcesService) { super(r); } }
@Controller('expenses') export class ExpensesController extends CrudController { protected readonly resource = 'expenses'; constructor(r: ResourcesService) { super(r); } }
@Controller('entries') export class EntriesController extends CrudController { protected readonly resource = 'entries'; constructor(r: ResourcesService) { super(r); } }
@Controller('suppliers') export class SuppliersController extends CrudController { protected readonly resource = 'suppliers'; constructor(r: ResourcesService) { super(r); } }

// Splits one purchase between the schools: creates one expense/entry/bill per school with its
// share, linked by `group_id`. Writes to both schools at once, so it is owner-only.
@Controller('split')
export class SplitController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly audit: AuditService,
    @Inject(MODEL.School) private readonly schools: M<SchoolDoc>,
  ) {}

  @Post()
  async split(@CurrentUser() user: SessionUser, @Body() body: Json) {
    requireOwner(user, 'só a dona pode dividir uma compra entre as escolas');
    const { resource, data, mode, percentages } = body as { resource?: string; data?: Json; mode?: string; percentages?: Record<string, number> };
    if (!resource || !['expenses', 'entries', 'bills'].includes(resource)) throw new InputError('só despesas, lançamentos e contas podem ser divididos');
    if (!data || typeof data !== 'object') throw new InputError('dados da divisão ausentes');
    const { config } = this.resources.get(resource);
    await config.validate?.(data);
    const amountField = resource === 'expenses' ? 'monthly_amount' : 'amount';
    const schools = (await this.schools.find().sort('_id').lean()).map((e) => ({ id: String(e._id), children_count: e.children_count }));
    const splits = prorate(Number(data[amountField]), schools, mode as string, percentages);
    const group_id = randomUUID();
    const base = pickFields(config.cols, data);
    const docs = await config.model.create(splits.filter((p) => p.amount > 0).map((p) => ({
      ...base, school_id: p.school_id, [amountField]: p.amount, group_id, total_amount: Number(data[amountField]), split_pct: p.pct,
    })));
    for (const doc of docs) {
      await this.audit.log(user, `${resource}.create`, { entity: resource, entity_id: doc._id, school_id: doc.school_id, after: { ...docSummary(resource, doc.toObject()), group_id } });
    }
    return { group_id, splits, ids: docs.map((d) => String(d._id)) };
  }
}
