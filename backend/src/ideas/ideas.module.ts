import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { TasksModule } from '../tasks/tasks.module';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';

@Module({
  imports: [HouseholdsModule, TasksModule],
  controllers: [IdeasController],
  providers: [IdeasService],
})
export class IdeasModule {}
