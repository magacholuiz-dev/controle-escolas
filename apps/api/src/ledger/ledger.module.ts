import { Module } from '@nestjs/common';
import { EntriesController, ExpensesController, RevenuesController, SplitController, SuppliersController } from './ledger.controller';

@Module({ controllers: [RevenuesController, ExpensesController, EntriesController, SuppliersController, SplitController] })
export class LedgerModule {}
