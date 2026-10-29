import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { BillsService } from './bills.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, BillsService],
})
export class ExpensesModule {}
