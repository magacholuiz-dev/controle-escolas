import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { ResourcesModule } from './resources/resources.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { PeopleModule } from './people/people.module';
import { LedgerModule } from './ledger/ledger.module';
import { BillsModule } from './bills/bills.module';
import { TuitionModule } from './tuition/tuition.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { ReportsModule } from './reports/reports.module';
import { BankModule } from './bank/bank.module';

@Module({
  imports: [
    DatabaseModule, CommonModule, ResourcesModule, AuthModule, UsersModule, SchoolsModule, PeopleModule, LedgerModule,
    BillsModule, TuitionModule, ScenariosModule, ReportsModule, BankModule,
  ],
})
export class AppModule {}
