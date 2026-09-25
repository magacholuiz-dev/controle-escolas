import { Module } from '@nestjs/common';
import { ChildrenController, EmployeesController, SeveranceController } from './people.controller';
import { SeveranceService } from './severance.service';

@Module({ controllers: [EmployeesController, ChildrenController, SeveranceController], providers: [SeveranceService] })
export class PeopleModule {}
