import { Module } from '@nestjs/common';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { BillsModule } from '../bills/bills.module';
import { TuitionModule } from '../tuition/tuition.module';

@Module({ imports: [BillsModule, TuitionModule], controllers: [BankController], providers: [BankService] })
export class BankModule {}
