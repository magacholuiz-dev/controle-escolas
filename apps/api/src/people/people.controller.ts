import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { occupancy, InputError } from '@controle-escolas/domain';
import { Inject } from '@nestjs/common';
import { CrudController } from '../resources/crud.controller';
import { ResourcesService } from '../resources/resources.service';
import { SeveranceService } from './severance.service';
import { CurrentUser, Scope } from '../common/decorators';
import { checkAllowed } from '../common/scope';
import { requireId, type Body as Json } from '../common/validation';
import type { SessionUser } from '../common/session';
import { MODEL } from '../database/models';
import type { ChildDoc, M, SchoolDoc } from '../database/schemas';

@Controller('employees')
export class EmployeesController extends CrudController {
  protected readonly resource = 'employees';
  constructor(resources: ResourcesService) { super(resources); }
}

@Controller('children')
export class ChildrenController extends CrudController {
  protected readonly resource = 'children';
  constructor(
    resources: ResourcesService,
    @Inject(MODEL.School) private readonly schools: M<SchoolDoc>,
    @Inject(MODEL.Child) private readonly children: M<ChildDoc>,
  ) { super(resources); }

  @Get('occupancy')
  async occupancy(@Query('school_id') schoolIdParam: string, @Scope() allowed: string[] | null) {
    const schoolId = requireId(schoolIdParam, 'school_id');
    checkAllowed(allowed, schoolId);
    const school = await this.schools.findById(schoolId).select('capacity').lean();
    if (!school) throw new InputError('escola não encontrada', 404);
    const children = await this.children.find({ school_id: schoolId as never }).select('enrollment_date exit_date').lean();
    return occupancy(children, school.capacity, new Date().toISOString().slice(0, 10));
  }
}

@Controller('severance')
export class SeveranceController {
  constructor(private readonly severance: SeveranceService) {}

  @Get() simulate(@Query() q: Record<string, unknown>, @Scope() a: string[] | null) { return this.severance.simulate(q, a); }
  @Post() apply(@CurrentUser() u: SessionUser, @Body() b: Json, @Scope() a: string[] | null) { return this.severance.apply(u, b, a); }
}
