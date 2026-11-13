import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { IdeaCommentsController, TaskCommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [TaskCommentsController, IdeaCommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
