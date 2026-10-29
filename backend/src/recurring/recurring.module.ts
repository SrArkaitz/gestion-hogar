import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [RecurringController],
  providers: [RecurringService],
})
export class RecurringModule {}
