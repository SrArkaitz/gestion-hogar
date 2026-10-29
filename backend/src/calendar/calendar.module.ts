import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
